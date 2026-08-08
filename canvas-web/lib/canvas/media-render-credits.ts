/** 与 book-mall/lib/media/media-render-credits.ts 保持同步 */

export const MEDIA_RENDER_BASE_CREDITS = 20;
export const MEDIA_RENDER_ASR_SURCHARGE_CREDITS = 10;

export function computeMediaRenderCreditsPreview(input: {
  burnIn: boolean;
  subtitleMode: "script" | "asr";
}): number {
  const base = MEDIA_RENDER_BASE_CREDITS;
  if (input.burnIn && input.subtitleMode === "asr") {
    return base + MEDIA_RENDER_ASR_SURCHARGE_CREDITS;
  }
  return base;
}
