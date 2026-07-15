/** canvas-web 顶部导航 */

export type CanvasNavItem = {
  href: string;
  label: string;
};

export const CANVAS_NAV_ITEMS: CanvasNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "我的画布" },
];

/** 「我的画布」内页居中子导航（原顶栏二级入口） */
export const CANVAS_PROJECTS_SUB_NAV: CanvasNavItem[] = [
  { href: "/assets", label: "项目资产" },
  { href: "/characters", label: "角色库" },
  { href: "/scripts", label: "脚本" },
  { href: "/storyboards", label: "分镜" },
  { href: "/guides/project-assets", label: "资产指南" },
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
