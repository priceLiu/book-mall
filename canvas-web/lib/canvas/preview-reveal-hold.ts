/** 生成刚结束、预览地址还没到或图片还没解码 */
export const PREVIEW_REVEAL_RUNNING = "\0running";

/**
 * 出图状态结束后，预览图真正画出来之前继续保持「生成中」。
 * 避免中间闪回空白占位。已有图打开卡片时不进入等待。
 */
export function nextPreviewRevealHold(
  holdUrl: string | null,
  isGenerating: boolean,
  failed: boolean,
  previewUrl: string | undefined,
  previewReady: boolean,
): string | null {
  if (failed) return null;
  if (isGenerating) return PREVIEW_REVEAL_RUNNING;
  if (previewReady) return null;
  if (!previewUrl) {
    return holdUrl === PREVIEW_REVEAL_RUNNING ? PREVIEW_REVEAL_RUNNING : null;
  }
  if (
    holdUrl === PREVIEW_REVEAL_RUNNING ||
    (holdUrl !== null && holdUrl !== previewUrl)
  ) {
    return previewUrl;
  }
  return holdUrl;
}

export function previewRevealHolding(
  holdUrl: string | null,
  previewUrl: string | undefined,
): boolean {
  if (!holdUrl) return false;
  if (holdUrl === PREVIEW_REVEAL_RUNNING) return true;
  return holdUrl === previewUrl;
}
