import { DETAIL_PAGE_SUITE_NEGATIVE_PROMPT } from "@/lib/ecom/detail-page-suite/types";

/** 允许画面带排版文案时，去掉全局负向里的「文字」禁令（仍禁止乱码等） */
export const DETAIL_PAGE_SUITE_NEGATIVE_PROMPT_ALLOW_BURN_IN_COPY =
  `${DETAIL_PAGE_SUITE_NEGATIVE_PROMPT.replace(/文字，/, "")}，长段落说明，密集小字正文，产品说明书式排版，除指定标题外的任何叠加文案`;

/** 烧字进图仅适合短标题/钩子；更长文案应走后续整页排版，不宜强塞生图模型 */
export const HIT_BURN_IN_COPY_MAX_CHARS = 48;

export function normalizeHitBurnInCopy(raw: string | undefined): string {
  const copy = raw?.trim() ?? "";
  if (!copy) return "";
  if (copy.length <= HIT_BURN_IN_COPY_MAX_CHARS) return copy;
  return copy.slice(0, HIT_BURN_IN_COPY_MAX_CHARS);
}

export function buildHitDetailPageImagePrompt(opts: {
  positivePrompt: string;
  slotCopy?: string;
  includeSlotCopyOnImage: boolean;
}): string {
  const scene = opts.positivePrompt.trim();
  if (!opts.includeSlotCopyOnImage) return scene;
  const copy = normalizeHitBurnInCopy(opts.slotCopy);
  if (!copy) return scene;
  return [
    scene,
    "",
    "【摄影画面】以上场景/商品/氛围描述只用于构图与光影，不得把上述句子渲染成画面上的文字。",
    "【唯一允许出现的排版文字】在画面留白区用电商详情页短标题风格展示以下文案，逐字一致，1～2 行主标题字号，禁止段落正文：",
    `「${copy}」`,
    "禁止出现上述标题以外的任何中文/英文/数字叠加、水印、说明段落、卖点列表。",
  ].join("\n");
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
