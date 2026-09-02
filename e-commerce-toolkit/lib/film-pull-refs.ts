import type {
  FilmPullCharacterRef,
  FilmPullProductionShot,
  FilmPullRefMatch,
} from "@/lib/film-pull-types";

export const FILM_PULL_REF_MAX_PER_ROLE = 6;

export type FilmPullRefRole = "model" | "product";

export type FilmPullMentionCatalogEntry = {
  ref: FilmPullCharacterRef;
  token: string;
  index: number;
  role: FilmPullRefRole;
};

const FILM_PULL_MENTION_TOKEN_RE = /@图片(\d+)/g;

export function isFilmPullModelRefId(id: string): boolean {
  return id.startsWith("ref-film-pull-model-");
}

export function isFilmPullProductRefId(id: string): boolean {
  return id.startsWith("ref-film-pull-product-");
}

export function listFilmPullModelRefs(refs: FilmPullCharacterRef[]): FilmPullCharacterRef[] {
  return refs.filter((r) => isFilmPullModelRefId(r.id) && r.ossUrl?.trim());
}

export function listFilmPullProductRefs(refs: FilmPullCharacterRef[]): FilmPullCharacterRef[] {
  return refs.filter((r) => isFilmPullProductRefId(r.id) && r.ossUrl?.trim());
}

export function buildFilmPullMentionCatalog(
  characterRefs: FilmPullCharacterRef[],
): FilmPullMentionCatalogEntry[] {
  const entries: FilmPullMentionCatalogEntry[] = [];
  let index = 1;
  for (const ref of listFilmPullModelRefs(characterRefs)) {
    entries.push({ ref, token: `@图片${index}`, index, role: "model" });
    index += 1;
  }
  for (const ref of listFilmPullProductRefs(characterRefs)) {
    entries.push({ ref, token: `@图片${index}`, index, role: "product" });
    index += 1;
  }
  return entries;
}

function mergeUniqueRefIds(lists: string[][]): string[] {
  return [...new Set(lists.flat().filter(Boolean))];
}

/** 从 Prompt @图片N 反查 ref id（与组装脚本 token 规则一致） */
export function parseFilmPullMentionRefIds(
  text: string,
  characterRefs: FilmPullCharacterRef[],
): { modelRefIds: string[]; productRefIds: string[] } {
  const catalog = buildFilmPullMentionCatalog(characterRefs);
  const modelSet = new Set<string>();
  const productSet = new Set<string>();
  for (const match of text.matchAll(FILM_PULL_MENTION_TOKEN_RE)) {
    const entry = catalog.find((c) => c.index === Number(match[1]));
    if (!entry) continue;
    if (entry.role === "model") modelSet.add(entry.ref.id);
    else productSet.add(entry.ref.id);
  }
  return {
    modelRefIds: [...modelSet],
    productRefIds: [...productSet],
  };
}

/** 内容区展示用：合并镜上 ref、refMatch 与 Prompt 中的 @图片N */
export function resolveFilmPullShotDisplayRefIds(
  shot: Pick<
    FilmPullProductionShot,
    "shotNo" | "modelRefIds" | "productRefIds" | "imagePrompt" | "videoPrompt"
  >,
  opts: {
    characterRefs: FilmPullCharacterRef[];
    refMatch?: FilmPullRefMatch | null;
  },
): { modelRefIds: string[]; productRefIds: string[] } {
  const matched = opts.refMatch?.shots.find((s) => s.shotNo === shot.shotNo);
  const fromPrompt = parseFilmPullMentionRefIds(
    `${shot.imagePrompt ?? ""}\n${shot.videoPrompt ?? ""}`,
    opts.characterRefs,
  );
  return {
    modelRefIds: mergeUniqueRefIds([
      shot.modelRefIds,
      matched?.modelRefIds ?? [],
      fromPrompt.modelRefIds,
    ]),
    productRefIds: mergeUniqueRefIds([
      shot.productRefIds,
      matched?.productRefIds ?? [],
      fromPrompt.productRefIds,
    ]),
  };
}

export function readFilmPullProductBrief(project: {
  meta?: { productBrief?: string } | null;
}): string {
  return typeof project.meta?.productBrief === "string" ? project.meta.productBrief.trim() : "";
}
