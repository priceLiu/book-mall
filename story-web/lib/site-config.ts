/** 演示空间配置（一期固定模板；未来按用户 / slug 加载） */
export const DEMO_SPACE = {
  slug: "demo",
  ownerName: "演示创作者",
  title: "漫剧个人空间",
  tagline: "用 AI 速度，讲好你的漫剧故事",
  subtitle:
    "一人即剧场的创作空间：固定模板首页可对外发布，创作室、影像室与模型配置将在后续迭代接入。",
  /** 首页代表作（占位；发布到 book-mall 时将播放此作品） */
  featuredWork: {
    title: "《星尘旅人》预告",
    description: "科幻漫剧片段 · 模板演示 · 可直接播放",
    /** 使用 MDN 示例视频作为占位，避免依赖本地大文件 */
    videoSrc: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    poster: undefined as string | undefined,
  },
} as const;

export type StoryNavItem = {
  href: string;
  label: string;
};

export const STORY_NAV_ITEMS: StoryNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/studio", label: "创作室" },
  { href: "/media", label: "影像室" },
  { href: "/models", label: "模型配置" },
];

export function getStoryWebOrigin(): string {
  const raw =
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN
      : process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN) ?? "http://localhost:3003";
  return raw.replace(/\/$/, "");
}

export function getBookMallOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_BOOK_MALL_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function getToolWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_TOOL_WEB_ORIGIN ?? "http://localhost:3001";
  return raw.replace(/\/$/, "");
}
