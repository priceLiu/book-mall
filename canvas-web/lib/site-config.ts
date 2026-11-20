/** canvas-web 顶部导航 */

export const CANVAS_SITE_BRAND_NAME = "ZX 无限画布";

export type CanvasNavItem = {
  href: string;
  label: string;
};

export const CANVAS_NAV_ITEMS: CanvasNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "我的画布" },
];

/** 管理中心 · 子导航（仅 /admin/* 页） */
export const CANVAS_ADMIN_SUB_NAV: CanvasNavItem[] = [
  { href: "/admin/portal", label: "工作流管理" },
  { href: "/admin/film", label: "影视作品" },
  { href: "/admin/templates", label: "模板管理" },
];

/** 顶栏一级 · 项目资产说明（在「管理中心」右侧） */
export const CANVAS_ASSET_GUIDE_NAV: CanvasNavItem = {
  href: "/guides/project-assets",
  label: "资产指南",
};

/** 顶栏「我的画布」下拉子入口（画布列表仍点主按钮进 /projects） */
export const CANVAS_PROJECTS_SUB_NAV: CanvasNavItem[] = [
  { href: "/assets", label: "我的资产" },
  { href: "/characters", label: "角色库" },
  { href: "/scripts", label: "脚本" },
  { href: "/storyboards", label: "分镜" },
  { href: "/style-library", label: "风格库" },
];

export function getCanvasWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN ?? "http://localhost:3004";
  return raw.replace(/\/$/, "");
}

export function getBookMallOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
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
