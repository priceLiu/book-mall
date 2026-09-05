/** 管理员姿势参考图生成 · Prompt 拼装 */
export function assemblePoseStudioPreviewPrompt(opts: {
  poseDescription: string;
  garmentDescription?: string;
  hasGarmentRef?: boolean;
  sceneText?: string;
}): string {
  const garmentText = opts.garmentDescription?.trim()
    || (opts.hasGarmentRef ? "穿着与服装参考图一致的款式与颜色" : "穿着简约基础款服装");

  const parts = [
    "全身人像摄影",
    "参考模特身份保持一致",
    garmentText,
    opts.poseDescription.trim(),
    opts.sceneText?.trim() || "浅灰摄影棚背景，均匀柔光",
    "高清电商展示，无水印",
  ].filter(Boolean);

  return `${parts.join("，")}。负面：畸形肢体，多余手指，换脸，水印。`;
}
