/** 七类 billingCategory 展示标签（与 book-mall billing-category.ts 一致） */
export const BILLING_CATEGORY_LABEL: Record<string, string> = {
  TEXT_TO_IMAGE: "文生图（含试衣）",
  IMAGE_TO_VIDEO: "图生视频",
  VIDEO_TO_VIDEO: "视频生视频",
  VIDEO_UNDERSTANDING: "视频理解",
  TTS: "TTS / 语音",
  TEXT: "文字",
};

export function billingCategoryLabel(cat: string | null | undefined): string {
  if (!cat) return "—";
  return BILLING_CATEGORY_LABEL[cat] ?? cat;
}
