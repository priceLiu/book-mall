import manifest from "@/src/shared/landing-videos.manifest.json";

const DEMO_VIDEO_SOURCES = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
] as const;

/** 创作室卡片悬停预览 · 按序号映射 OSS / 演示视频 */
export function resolveDiscoverPreviewVideoUrl(index: number): string {
  const videos = manifest.videos;
  if (videos?.length) {
    return videos[index % videos.length]!.url;
  }
  return DEMO_VIDEO_SOURCES[index % DEMO_VIDEO_SOURCES.length]!;
}
