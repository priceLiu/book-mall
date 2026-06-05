/** 分镜/成片预览容器宽高比 class */
export function storyboardPreviewAspectClass(
  aspectRatio: "16:9" | "9:16" | "1:1",
): string {
  if (aspectRatio === "16:9") return "aspect-[16/9]";
  if (aspectRatio === "1:1") return "aspect-square";
  return "aspect-[9/16]";
}

/** 预览区统一高度，避免 flex 子项塌陷成细条 */
export const STORYBOARD_PREVIEW_MIN_H = "min-h-[200px]";

/** 镜头卡片宽度（须容纳悬停 4 个工具按钮，竖屏不小于 ~176px 避免图标变形） */
export function storyboardPanelCardWidth(
  aspectRatio: "16:9" | "9:16",
): number {
  return aspectRatio === "16:9" ? 300 : 188;
}
