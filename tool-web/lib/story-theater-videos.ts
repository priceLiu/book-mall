import manifest from "./story-theater-videos.manifest.json";

const FALLBACK = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

export function getStoryTheaterVideoPool(): string[] {
  const urls = manifest.videos?.map((v) => v.url).filter(Boolean) ?? [];
  return urls.length > 0 ? urls : FALLBACK;
}

/** 从已上传 OSS 视频池中随机取 n 条（服务端调用 → 每次刷新不同） */
export function pickRandomStoryVideos(count: number): string[] {
  const pool = getStoryTheaterVideoPool();
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
