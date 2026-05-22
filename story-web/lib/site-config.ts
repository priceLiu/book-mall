export type StoryNavItem = {
  href: string;
  label: string;
};

export const STORY_NAV_ITEMS: StoryNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "创作室" },
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
