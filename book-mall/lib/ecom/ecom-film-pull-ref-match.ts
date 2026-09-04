import type { FilmPullAnalyzePatch } from "@/lib/ecom/ecom-film-pull-structured";
import {
  listFilmPullModelRefs,
  listFilmPullProductRefs,
} from "@/lib/ecom/ecom-film-pull-refs";
import {
  isLegacyFilmPullAnalyzePatch,
  type FilmPullCharacterRef,
  type FilmPullRefMatch,
  type FilmPullRefMatchShot,
} from "@/lib/ecom/ecom-film-pull-types";

function isProductCloseUpShot(shot: FilmPullAnalyzePatch["shots"][number]): boolean {
  const scale = shot.shotScale.trim();
  const narrative = shot.narrativeFunction.trim();
  if (/特写|大特写|产品|细节|局部/.test(scale)) return true;
  if (/产品|卖点|展示|细节|功能/.test(narrative)) return true;
  return false;
}

function defaultRefMatchShot(
  shot: FilmPullAnalyzePatch["shots"][number],
  modelRefIds: string[],
  productRefIds: string[],
): FilmPullRefMatchShot {
  const modelIds = modelRefIds.length > 0 ? [modelRefIds[0]!] : [];
  const productIds =
    isProductCloseUpShot(shot) && productRefIds.length > 0 ? [productRefIds[0]!] : [];
  return {
    shotNo: shot.shotNo,
    modelRefIds: modelIds,
    productRefIds: productIds,
  };
}

/** 规则引擎：全镜带主模特；产品特写镜附加产品 ref */
export function buildFilmPullRefMatchRule(
  analyze: FilmPullAnalyzePatch,
  characterRefs: FilmPullCharacterRef[],
): FilmPullRefMatch {
  const modelRefIds = listFilmPullModelRefs(characterRefs).map((r) => r.id);
  const productRefIds = listFilmPullProductRefs(characterRefs).map((r) => r.id);
  if (modelRefIds.length === 0) {
    throw new Error("请先上传至少一张模特图");
  }
  return {
    shots: analyze.shots.map((shot) =>
      defaultRefMatchShot(shot, modelRefIds, productRefIds),
    ),
  };
}

export function resolveRefUrlsForShot(
  characterRefs: FilmPullCharacterRef[],
  matchShot: FilmPullRefMatchShot,
): string[] {
  const byId = new Map(characterRefs.map((r) => [r.id, r.ossUrl]));
  const urls: string[] = [];
  for (const id of [...matchShot.modelRefIds, ...matchShot.productRefIds]) {
    const url = byId.get(id)?.trim();
    if (url) urls.push(url);
  }
  return urls;
}

/** 制作脚本镜 ref：优先 productionPlan 上的 model/productRefIds，回退 refMatch */
export function resolveProductionShotRefUrls(
  characterRefs: FilmPullCharacterRef[],
  shot: { shotNo: number; modelRefIds: string[]; productRefIds: string[] },
  refMatch?: FilmPullRefMatch | null,
): string[] {
  if (shot.modelRefIds.length > 0 || shot.productRefIds.length > 0) {
    return resolveRefUrlsForShot(characterRefs, {
      shotNo: shot.shotNo,
      modelRefIds: shot.modelRefIds,
      productRefIds: shot.productRefIds,
    });
  }
  const matched = refMatch?.shots.find((s) => s.shotNo === shot.shotNo);
  if (matched) return resolveRefUrlsForShot(characterRefs, matched);
  return [];
}

export async function applyFilmPullRefMatchAuto(
  userId: string,
  projectId: string,
): Promise<FilmPullRefMatch> {
  const { getEcomFilmPullProject, saveFilmPullRefMatch } = await import(
    "@/lib/ecom/ecom-film-pull-service"
  );
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const analyze = project.analyzeResult?.structured;
  if (!analyze) throw new Error("请先完成拉片分析");
  if (!isLegacyFilmPullAnalyzePatch(analyze)) {
    throw new Error("Pro2 拉片结果暂不支持自动参考图匹配");
  }
  const refMatch = buildFilmPullRefMatchRule(analyze, project.characterRefs);
  await saveFilmPullRefMatch(userId, projectId, refMatch);
  return refMatch;
}
