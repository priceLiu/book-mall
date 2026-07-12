import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * 跨门户头部导航：链接画布 / 快速复制 / 电商 / 故事版，工具站指向 Book。
 * 跨门户跳转经 Book `re-enter`：已登录用户（持有 Book 会话）无感换票进入目标门户。
 */
type PortalKey = "story" | "canvas" | "quick-replica" | "e-commerce" | "tool";

function reEnter(book: string | null, app: PortalKey, fallback: string | null): string | null {
  if (!book) return fallback;
  if (app === "tool") return `${book.replace(/\/$/, "")}/tools`;
  return `${book.replace(/\/$/, "")}/api/sso/tools/re-enter?app=${app}&redirect=/`;
}

export function PortalNav({ current = "story" }: { current?: PortalKey }) {
  const book = getMainSiteOrigin();
  const canvasOrigin = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim() || null;
  const qrOrigin = process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim() || null;
  const ecomOrigin = process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim() || null;
  const storyOrigin = process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim() || null;

  const items: { key: PortalKey; label: string; href: string | null }[] = [
    { key: "story", label: "故事版", href: reEnter(book, "story", storyOrigin) },
    { key: "canvas", label: "画布", href: reEnter(book, "canvas", canvasOrigin) },
    { key: "quick-replica", label: "快速复制", href: reEnter(book, "quick-replica", qrOrigin) },
    { key: "e-commerce", label: "电商工具箱", href: reEnter(book, "e-commerce", ecomOrigin) },
    { key: "tool", label: "工具站", href: reEnter(book, "tool", book) },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((it) =>
        it.href ? (
          <a
            key={it.key}
            href={it.href}
            className={`story-sans rounded-full px-3 py-1.5 transition ${
              it.key === current
                ? "bg-white/10 text-white ring-1 ring-white/15"
                : "text-[var(--story-muted)] hover:bg-white/5 hover:text-white"
            }`}
          >
            {it.label}
          </a>
        ) : (
          <span key={it.key} className="story-sans rounded-full px-3 py-1.5 text-[var(--story-muted)]">
            {it.label}
          </span>
        ),
      )}
    </nav>
  );
}
