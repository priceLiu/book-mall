import { DETAIL_PAGE_SUITE_NEGATIVE_PROMPT } from "@/lib/ecom/detail-page-suite/types";

/** 允许画面带排版文案时，去掉全局负向里的「文字」禁令（仍禁止乱码等） */
export const DETAIL_PAGE_SUITE_NEGATIVE_PROMPT_ALLOW_BURN_IN_COPY =
  DETAIL_PAGE_SUITE_NEGATIVE_PROMPT.replace(/文字，/, "");

export function buildHitDetailPageImagePrompt(opts: {
  positivePrompt: string;
  slotCopy?: string;
  includeSlotCopyOnImage: boolean;
}): string {
  const scene = opts.positivePrompt.trim();
  if (!opts.includeSlotCopyOnImage) return scene;
  const copy = opts.slotCopy?.trim();
  if (!copy) return scene;
  return `${scene}\n\n【画面需清晰呈现以下中文电商详情页文案，排版美观、字号层次分明，禁止乱码与水印】\n${copy}`;
}

export function mergeHitDetailPageImageNegativePrompt(
  slotNegative: string | undefined,
  includeSlotCopyOnImage: boolean,
): string {
  const base = includeSlotCopyOnImage
    ? DETAIL_PAGE_SUITE_NEGATIVE_PROMPT_ALLOW_BURN_IN_COPY
    : DETAIL_PAGE_SUITE_NEGATIVE_PROMPT;
  const extra = slotNegative?.trim();
  if (!extra) return base;
  return `${base}，${extra}`;
}
