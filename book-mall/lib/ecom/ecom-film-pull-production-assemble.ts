import type { FilmPullAnalyzePatch } from "@/lib/ecom/ecom-film-pull-structured";
import {
  buildFilmPullMentionCatalog,
  listFilmPullModelRefs,
  listFilmPullProductRefs,
} from "@/lib/ecom/ecom-film-pull-refs";
import type {
  FilmPullCharacterRef,
  FilmPullProductionPlan,
  FilmPullProductionShot,
  FilmPullRefMatch,
  FilmPullRefMatchShot,
} from "@/lib/ecom/ecom-film-pull-types";

function tokensForRefs(
  characterRefs: FilmPullCharacterRef[],
  modelRefIds: string[],
  productRefIds: string[],
): string {
  const catalog = buildFilmPullMentionCatalog(characterRefs);
  const idSet = new Set([...modelRefIds, ...productRefIds]);
  const tokens = catalog.filter((e) => idSet.has(e.ref.id)).map((e) => e.token);
  return tokens.length > 0 ? `${tokens.join(" ")} ` : "";
}

function buildImagePrompt(
  shot: FilmPullAnalyzePatch["shots"][number],
  characterRefs: FilmPullCharacterRef[],
  matchShot: FilmPullRefMatchShot,
  productBrief?: string,
): string {
  const prefix = tokensForRefs(characterRefs, matchShot.modelRefIds, matchShot.productRefIds);
  const body = [
    shot.sceneEnvironment !== "无" ? shot.sceneEnvironment : "",
    shot.subjectBlocking !== "无" ? shot.subjectBlocking : "",
    shot.composition !== "无" ? shot.composition : "",
    shot.lightingSetup !== "无" ? shot.lightingSetup : "",
    shot.toneContrast !== "无" ? shot.toneContrast : "",
    productBrief?.trim() ? `产品：${productBrief.trim()}` : "",
  ]
    .filter(Boolean)
    .join("；");
  return `${prefix}${body || shot.aiVisualPrompt}`.trim();
}

function buildVideoPrompt(
  shot: FilmPullAnalyzePatch["shots"][number],
  characterRefs: FilmPullCharacterRef[],
  matchShot: FilmPullRefMatchShot,
  productBrief?: string,
): string {
  const prefix = tokensForRefs(characterRefs, matchShot.modelRefIds, matchShot.productRefIds);
  const motion = [
    shot.shotScale,
    shot.cameraAngle,
    shot.cameraMovement,
    shot.focalLengthPerspective,
  ]
    .filter((v) => v && v !== "无")
    .join("·");
  const body = [
    shot.aiVisualPrompt !== "无" ? shot.aiVisualPrompt : "",
    motion ? `运镜：${motion}` : "",
    `时长约 ${shot.durationSec.toFixed(1)} 秒`,
    productBrief?.trim() ? `产品：${productBrief.trim()}` : "",
  ]
    .filter(Boolean)
    .join("；");
  return `${prefix}${body}`.trim();
}

function resolveMatchShot(
  refMatch: FilmPullRefMatch,
  shotNo: number,
  characterRefs: FilmPullCharacterRef[],
): FilmPullRefMatchShot {
  const found = refMatch.shots.find((s) => s.shotNo === shotNo);
  if (found) return found;
  const modelRefIds = listFilmPullModelRefs(characterRefs).map((r) => r.id).slice(0, 1);
  const productRefIds = listFilmPullProductRefs(characterRefs).map((r) => r.id).slice(0, 1);
  return { shotNo, modelRefIds, productRefIds };
}

/** 规则引擎拼装制作脚本表（继承拉片全维度） */
export function assembleFilmPullProductionPlan(opts: {
  analyze: FilmPullAnalyzePatch;
  refMatch: FilmPullRefMatch;
  characterRefs: FilmPullCharacterRef[];
  productBrief?: string;
}): FilmPullProductionPlan {
  const { analyze, refMatch, characterRefs, productBrief } = opts;
  const shots: FilmPullProductionShot[] = analyze.shots.map((shot) => {
    const matchShot = resolveMatchShot(refMatch, shot.shotNo, characterRefs);
    return {
      ...shot,
      modelRefIds: [...matchShot.modelRefIds],
      productRefIds: [...matchShot.productRefIds],
      imagePrompt: buildImagePrompt(shot, characterRefs, matchShot, productBrief),
      videoPrompt: buildVideoPrompt(shot, characterRefs, matchShot, productBrief),
      productInteraction: "none",
      sellpointNote: productBrief?.trim() ? productBrief.trim() : "",
      imageUrl: null,
      videoUrl: null,
      ttsUrl: null,
      status: "pending_video",
    };
  });

  return {
    globalConfig: {
      characterUnifiedStyle: analyze.meta.artStyle !== "无" ? analyze.meta.artStyle : "",
      globalLighting: "",
      resolution: "1080×1920",
      fps: "24fps",
      globalVisualTone: analyze.meta.artStyle !== "无" ? analyze.meta.artStyle : "",
    },
    shots,
  };
}

export async function applyFilmPullProductionAssemble(
  userId: string,
  projectId: string,
): Promise<FilmPullProductionPlan> {
  const { getEcomFilmPullProject, saveFilmPullProductionPlan } = await import(
    "@/lib/ecom/ecom-film-pull-service"
  );
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const analyze = project.analyzeResult?.structured;
  if (!analyze) throw new Error("请先完成拉片分析");
  const refMatch = project.refMatch;
  if (!refMatch?.shots.length) throw new Error("请先完成参考图匹配");

  const plan = assembleFilmPullProductionPlan({
    analyze,
    refMatch,
    characterRefs: project.characterRefs,
    productBrief: project.meta?.productBrief ?? undefined,
  });

  await saveFilmPullProductionPlan(userId, projectId, plan);
  return plan;
}
