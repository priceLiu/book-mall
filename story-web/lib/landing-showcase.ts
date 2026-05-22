export type HotComicCover = {
  id: string;
  src: string;
  title: string;
};

export type DiscoverVideo = {
  id: string;
  src: string;
  title: string;
  author: string;
  poster?: string;
};

export type DiscoverVideoItem = DiscoverVideo & { playbackSrc: string };

export type LandingShowcase = {
  covers: HotComicCover[];
  videos: DiscoverVideoItem[];
};

const COVER_TITLES = [
  "星尘旅人",
  "霓虹回声",
  "深海信标",
  "旧城档案",
  "量子花火",
  "月面残响",
  "零号剧场",
  "雾都追光",
  "逆鳞",
  "云端牧歌",
  "时隙旅社",
  "琥珀黎明",
  "无名航线",
  "碎镜王国",
  "最后一帧",
] as const;

/** public/imgs/covers 下 15 张竖屏封面（9:16） */
export const HOT_COMIC_COVERS: HotComicCover[] = COVER_TITLES.map((title, index) => ({
  id: `cover-${index + 1}`,
  src: `/imgs/covers/cover-${index + 1}.png`,
  title,
}));

/** 演示用占位视频（public/video 尚无文件时使用） */
export const DEMO_VIDEO_SOURCES = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
] as const;

const MOCK_DISCOVER_VIDEOS: DiscoverVideo[] = [
  {
    id: "demo-1",
    src: "/video/story-01.mp4",
    title: "《星尘旅人》第一话",
    author: "林晚",
    poster: "/imgs/covers/cover-1.png",
  },
  {
    id: "demo-2",
    src: "/video/story-02.mp4",
    title: "霓虹回声 · 预告",
    author: "阿Ken",
    poster: "/imgs/covers/cover-2.png",
  },
  {
    id: "demo-3",
    src: "/video/story-03.mp4",
    title: "深海信标",
    author: "Studio M",
    poster: "/imgs/covers/cover-3.png",
  },
  {
    id: "demo-4",
    src: "/video/story-04.mp4",
    title: "旧城档案 · 序章",
    author: "陈一",
    poster: "/imgs/covers/cover-4.png",
  },
  {
    id: "demo-5",
    src: "/video/story-05.mp4",
    title: "量子花火",
    author: "Nova",
    poster: "/imgs/covers/cover-5.png",
  },
  {
    id: "demo-6",
    src: "/video/story-06.mp4",
    title: "月面残响",
    author: "白夜",
    poster: "/imgs/covers/cover-6.png",
  },
];

function demoPlaybackSrc(index: number): string {
  return DEMO_VIDEO_SOURCES[index % DEMO_VIDEO_SOURCES.length];
}

export function getMockDiscoverVideos(): DiscoverVideoItem[] {
  return MOCK_DISCOVER_VIDEOS.map((item, index) => ({
    ...item,
    playbackSrc: demoPlaybackSrc(index),
  }));
}

export function getDefaultLandingShowcase(): LandingShowcase {
  return {
    covers: HOT_COMIC_COVERS,
    videos: getMockDiscoverVideos(),
  };
}
