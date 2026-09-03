import type { SubtitleBurnInStyle } from "@private/media-render-subtitle-style/subtitle-style-options";
import type { EcomMediaRenderProfileInput } from "@/lib/ecom-storyboard-api";

/** 种草视频合成：烧录口播字幕 + 用户选定样式 */
export function buildSeedVideoComposeProfile(
  style: SubtitleBurnInStyle,
): EcomMediaRenderProfileInput {
  return {
    subtitle: {
      mode: "script",
      burnIn: true,
      style,
    },
  };
}

/** 未传 style 时服务端缺省等价 ASS 20（sizeKey large） */
export const SEED_VIDEO_LEGACY_SUBTITLE_ASS_SIZE = 20;
