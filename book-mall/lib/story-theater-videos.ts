import manifest from "./story-theater-videos.manifest.json";

const FALLBACK = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

export type StoryHeroClip = {
  url: string;
  poster: string;
};

/** 首屏全屏背景：与 story-web 首页「发现更多」同源 OSS 16:9 视频 */
export type StoryHeroBackground = StoryHeroClip;

const LOCAL_HERO_BACKGROUND: StoryHeroBackground = {
  url: "/home-hero-opt.mp4",
  poster: "/home-hero-poster.webp",
};

/** 与 story-web/public/imgs/covers 对齐；book-mall 同源静态资源 */
export function posterForStoryVideoUrl(url: string): string {
  const match = /demo-(\d+)\.mp4/i.exec(url);
  const num = match ? Number(match[1]) : 1;
  const idx = ((Math.max(1, num) - 1) % 15) + 1;
  return `/imgs/covers/cover-${idx}.png`;
}

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

/** 首屏 Hero 小窗：视频 URL + 竖屏封面（避免加载前白屏） */
export function pickRandomStoryVideoClips(count: number): StoryHeroClip[] {
  return pickRandomStoryVideos(count).map((url) => ({
    url,
    poster: posterForStoryVideoUrl(url),
  }));
}

/** 首屏全屏背景：每次刷新随机一条 OSS 16:9 漫剧片段；无 OSS 池时回退本地压缩视频 */
export function pickRandomStoryHeroBackground(): StoryHeroBackground {
  const pool = getStoryTheaterVideoPool().filter((url) =>
    /demo-\d+\.mp4/i.test(url),
  );
  if (pool.length === 0) return LOCAL_HERO_BACKGROUND;
  const idx = Math.floor(Math.random() * pool.length);
  const url = pool[idx]!;
  return { url, poster: posterForStoryVideoUrl(url) };
}
