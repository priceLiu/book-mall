import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * 跨门户头部导航：链接画布 / 快速复制 / 电商，工具站指向 Book。
 * 跨门户跳转经 Book `re-enter`：已登录用户（持有 Book 会话）无感换票进入目标门户。
 */
type PortalKey = "quick-replica" | "canvas" | "e-commerce" | "tool";

function reEnter(book: string | null, app: PortalKey, fallback: string | null): string | null {
  if (!book) return fallback;
  if (app === "tool") return `${book.replace(/\/$/, "")}/tools`;
  return `${book.replace(/\/$/, "")}/api/sso/tools/re-enter?app=${app}&redirect=/`;
}

export function PortalNav({
  current = "e-commerce",
  variant = "light",
}: {
  current?: PortalKey;
  variant?: "light" | "dark";
}) {
  const book = getMainSiteOrigin();
  const canvasOrigin = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim() || null;
  const qrOrigin = process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim() || null;
  const ecomOrigin = process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim() || null;

  const items: { key: PortalKey; label: string; href: string | null }[] = [
    { key: "canvas", label: "画布", href: reEnter(book, "canvas", canvasOrigin) },
    { key: "quick-replica", label: "快速复制", href: reEnter(book, "quick-replica", qrOrigin) },
    { key: "e-commerce", label: "电商工具箱", href: reEnter(book, "e-commerce", ecomOrigin) },
    { key: "tool", label: "工具站", href: reEnter(book, "tool", book) },
  ];

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
