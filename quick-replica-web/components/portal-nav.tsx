import { getMainSiteOrigin } from "@/lib/site-origin";

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

export function PortalNav({ current = "quick-replica" }: { current?: PortalKey }) {
  const book = getMainSiteOrigin();
  const canvasOrigin = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim() || null;
  const qrOrigin = process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim() || null;
  const ecomOrigin = process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim() || null;
  const storyOrigin = process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim() || null;
  const commonToolsOrigin =
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN?.trim() ||
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN?.trim() ||
    null;

  const items: { key: PortalKey; label: string; href: string | null }[] = [
    {
      key: "common-tools",
      label: "常用工具",
      href: reEnter(book, "common-tools", commonToolsOrigin),
    },
    { key: "canvas", label: "画布", href: reEnter(book, "canvas", canvasOrigin) },
    { key: "e-commerce", label: "电商工具箱", href: reEnter(book, "e-commerce", ecomOrigin) },
    {
      key: "quick-replica",
      label: "快速复制",
      href: reEnter(book, "quick-replica", qrOrigin),
    },
    { key: "story", label: "故事版", href: reEnter(book, "story", storyOrigin) },
    { key: "tool", label: "工具站", href: book ? `${book.replace(/\/$/, "")}/tools` : null },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((it) =>
        it.href ? (
          <a
            key={it.key}
            href={it.href}
            className={`rounded-full px-3 py-1.5 transition ${
              it.key === current
                ? "bg-white/10 text-[var(--qr-text-primary)]"
                : "text-[var(--qr-text-muted)] hover:bg-white/5"
            }`}
          >
            {it.label}
          </a>
        ) : (
          <span key={it.key} className="rounded-full px-3 py-1.5 text-[var(--qr-text-muted)]">
            {it.label}
          </span>
        ),
      )}
    </nav>
  );
}
