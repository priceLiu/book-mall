/** 与 book-mall/lib/media/media-render-credits.ts 保持同步 */

export const MEDIA_RENDER_BASE_CREDITS = 20;
export const MEDIA_RENDER_ASR_SURCHARGE_CREDITS = 10;

export function computeMediaRenderCreditsPreview(input: {
  burnInSubtitles: boolean;
  subtitleMode: "script" | "asr" | "tts";
}): number {
  const base = MEDIA_RENDER_BASE_CREDITS;
  if (input.burnInSubtitles && input.subtitleMode === "asr") {
    return base + MEDIA_RENDER_ASR_SURCHARGE_CREDITS;
  }
  return base;
}
