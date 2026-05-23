/** canvas-web 顶部导航 */

export type CanvasNavItem = {
  href: string;
  label: string;
};

export const CANVAS_NAV_ITEMS: CanvasNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "我的画布" },
  { href: "/gallery", label: "画作" },
  { href: "/settings/providers", label: "配置" },
  { href: "/implementation", label: "实现逻辑" },
];

export function getCanvasWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN ?? "http://localhost:3004";
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

export function getStoryWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN ?? "http://localhost:3003";
  return raw.replace(/\/$/, "");
}
