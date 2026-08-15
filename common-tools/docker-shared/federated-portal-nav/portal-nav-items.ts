/** 跨门户 federated 顶栏 · 各子应用共用菜单项 */
export type PortalKey =
  | "common-tools"
  | "canvas"
  | "e-commerce"
  | "quick-replica"
  | "publisher"
  | "story"
  | "tool";

export type PortalNavItem = {
  key: PortalKey;
  label: string;
  href: string | null;
};

function reEnter(
  book: string | null,
  app: PortalKey,
  fallback: string | null,
  redirect = "/",
): string | null {
  if (!book) return fallback;
  const params = new URLSearchParams({ redirect });
  if (app !== "tool") params.set("app", app);
  return `${book.replace(/\/$/, "")}/api/sso/tools/re-enter?${params.toString()}`;
}

/** 构建各子站入口（Book SSO re-enter） */
export function buildPortalNavItems(bookOrigin: string | null): PortalNavItem[] {
  const canvasOrigin = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim() || null;
  const qrOrigin = process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim() || null;
  const ecomOrigin = process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim() || null;
  const storyOrigin = process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim() || null;
  const publisherOrigin =
    process.env.NEXT_PUBLIC_PUBLISHER_WEB_ORIGIN?.trim() ||
    process.env.PUBLISHER_WEB_PUBLIC_ORIGIN?.trim() ||
    null;
  const commonToolsOrigin =
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN?.trim() ||
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN?.trim() ||
    null;
  const toolOrigin = process.env.NEXT_PUBLIC_TOOL_WEB_ORIGIN?.trim() || null;

  return [
    {
      key: "common-tools",
      label: "常用工具",
      href: reEnter(bookOrigin, "common-tools", commonToolsOrigin),
    },
    { key: "canvas", label: "画布", href: reEnter(bookOrigin, "canvas", canvasOrigin) },
    {
      key: "e-commerce",
      label: "电商工具箱",
      href: reEnter(bookOrigin, "e-commerce", ecomOrigin),
    },
    {
      key: "quick-replica",
      label: "快速复刻",
      href: reEnter(bookOrigin, "quick-replica", qrOrigin),
    },
    {
      key: "publisher",
      label: "一键发布",
      href: reEnter(bookOrigin, "publisher", publisherOrigin),
    },
    { key: "story", label: "故事版", href: reEnter(bookOrigin, "story", storyOrigin) },
    {
      key: "tool",
      label: "工具站",
      href: reEnter(bookOrigin, "tool", toolOrigin, "/fitting-room"),
    },
  ];
}
