import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * 跨门户头部导航：经 Book re-enter 无感换票进入各子应用。
 */
export type PortalKey =
  | "common-tools"
  | "canvas"
  | "e-commerce"
  | "quick-replica"
  | "story"
  | "tool";

function reEnter(
  book: string | null,
  app: Exclude<PortalKey, "tool">,
  fallback: string | null,
): string | null {
  if (!book) return fallback;
  return `${book.replace(/\/$/, "")}/api/sso/tools/re-enter?app=${app}&redirect=/`;
}

export function buildPortalNavItems(book: string | null): Array<{
  key: PortalKey;
  label: string;
  href: string | null;
}> {
  const canvasOrigin = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim() || null;
  const qrOrigin = process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim() || null;
  const ecomOrigin = process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim() || null;
  const storyOrigin = process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim() || null;
  const commonToolsOrigin =
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN?.trim() ||
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN?.trim() ||
    null;

  return [
    {
      key: "common-tools",
      label: "常用工具",
      href: reEnter(book, "common-tools", commonToolsOrigin),
    },
    { key: "canvas", label: "画布", href: reEnter(book, "canvas", canvasOrigin) },
    {
      key: "e-commerce",
      label: "电商工具箱",
      href: reEnter(book, "e-commerce", ecomOrigin),
    },
    {
      key: "quick-replica",
      label: "快速复制",
      href: reEnter(book, "quick-replica", qrOrigin),
    },
    { key: "story", label: "故事版", href: reEnter(book, "story", storyOrigin) },
    {
      key: "tool",
      label: "工具站",
      href: book ? `${book.replace(/\/$/, "")}/tools` : null,
    },
  ];
}

export function PortalNav({
  current,
  variant = "light",
}: {
  current: PortalKey;
  variant?: "light" | "dark";
}) {
  const book = getMainSiteOrigin();
  const items = buildPortalNavItems(book);

  const activeClass =
    variant === "dark"
      ? "bg-white/15 text-white"
      : "bg-[#f5f5f7] text-[#1d1d1f]";
  const idleClass =
    variant === "dark"
      ? "text-white/60 hover:bg-white/10 hover:text-white"
      : "text-[#6e6e73] hover:bg-[#f5f5f7]";
  const disabledClass =
    variant === "dark" ? "text-white/35" : "text-[#86868b]";

  return (
    <nav className="flex flex-nowrap items-center justify-center gap-1 text-sm">
      {items.map((it) =>
        it.href ? (
          <a
            key={it.key}
            href={it.href}
            className={`shrink-0 rounded-full px-3 py-1.5 transition ${
              it.key === current ? activeClass : idleClass
            }`}
          >
            {it.label}
          </a>
        ) : (
          <span key={it.key} className={`shrink-0 rounded-full px-3 py-1.5 ${disabledClass}`}>
            {it.label}
          </span>
        ),
      )}
    </nav>
  );
}
