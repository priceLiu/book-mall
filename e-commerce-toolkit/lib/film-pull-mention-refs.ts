import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { FilmPullCharacterRef } from "@/lib/film-pull-types";
import { listFilmPullModelRefs, listFilmPullProductRefs } from "@/lib/film-pull-refs";

/** 模特 ref 先编号，再产品 ref — 与 book-mall buildFilmPullMentionCatalog 一致 */
export function buildFilmPullMentionRefs(
  characterRefs: FilmPullCharacterRef[],
): EcomPromptImageRef[] {
  const entries: EcomPromptImageRef[] = [];
  let index = 1;

  let modelIdx = 0;
  for (const ref of listFilmPullModelRefs(characterRefs)) {
    modelIdx += 1;
    entries.push({
      index,
      token: `@图片${index}`,
      kind: "model",
      kindIndex: modelIdx,
      url: ref.ossUrl,
      label: ref.label?.trim() || `模特 ${modelIdx}`,
      role: "model",
    });
    index += 1;
  }

  let productIdx = 0;
  for (const ref of listFilmPullProductRefs(characterRefs)) {
    productIdx += 1;
    entries.push({
      index,
      token: `@图片${index}`,
      kind: "product",
      kindIndex: productIdx,
      url: ref.ossUrl,
      label: ref.label?.trim() || `产品 ${productIdx}`,
      role: "product",
    });
    index += 1;
  }

  return entries;
}
