import type { SiteHomePlatformAppKey } from "@/lib/site-home/platform-apps";

const EX = "https://static.aiquickdraw.com/tools/example";
const OSS = "https://tool-mall.oss-cn-guangzhou.aliyuncs.com";

export type PlatformAppMedia = {
  posterUrl: string;
  videoUrl: string | null;
};

/** 首页平台应用入口封面（可后续替换为各子站正式宣传素材）。 */
const PLATFORM_APP_MEDIA: Record<SiteHomePlatformAppKey, PlatformAppMedia> = {
  canvas: {
    posterUrl: `${EX}/1775188169588_bgwi3VY9.png`,
    videoUrl: `${OSS}/story-web/landing/video/demo-1.mp4`,
  },
  story: {
    posterUrl: `${EX}/1775568822016_DdLRQiJT.png`,
    videoUrl: `${OSS}/story-web/landing/video/demo-2.mp4`,
  },
  "e-commerce": {
    posterUrl: `${EX}/1775188213576_znqR80kS.png`,
    videoUrl: `${OSS}/story-web/landing/video/demo-3.mp4`,
  },
  tool: {
    posterUrl: `${OSS}/quick-replica/builtin/qr-video-gallery-02.webp`,
    videoUrl: `${OSS}/quick-replica/builtin/qr-video-gallery-02-video.mp4`,
  },
  "quick-replica": {
    posterUrl: `${OSS}/quick-replica/builtin/qr-video-gallery-01.webp`,
    videoUrl: `${OSS}/quick-replica/builtin/qr-video-gallery-01-video.mp4`,
  },
  "common-tools": {
    posterUrl: `${OSS}/quick-replica/builtin/qr-image-gallery-03.webp`,
    videoUrl: null,
  },
  publisher: {
    posterUrl: `${EX}/1775122744247_eSHwJX1k.jpg`,
    videoUrl: null,
  },
  "prompt-optimizer": {
    posterUrl: `${EX}/1763662100739_DlBXJvdR.png`,
    videoUrl: null,
  },
  director: {
    posterUrl: `${EX}/1775568751210_gkLCFKS8.png`,
    videoUrl: `${OSS}/story-web/landing/video/demo-4.mp4`,
  },
};

export function platformAppMediaFor(key: SiteHomePlatformAppKey): PlatformAppMedia {
  return PLATFORM_APP_MEDIA[key];
}
