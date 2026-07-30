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

export function PortalNav({ current = "common-tools" }: { current?: PortalKey }) {
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
    <nav className="hidden flex-wrap items-center justify-center gap-1 text-sm sm:flex">
      {items.map((it) =>
        it.href ? (
          <a
            key={it.key}
            href={it.href}
            className={`rounded-full px-3 py-1.5 transition ${
              it.key === current
                ? "bg-[#f0f6ff] text-[#0071e3]"
                : "text-[#6e6e73] hover:bg-[#f5f5f7]"
            }`}
          >
            {it.label}
          </a>
        ) : (
          <span key={it.key} className="rounded-full px-3 py-1.5 text-[#86868b]">
            {it.label}
          </span>
        ),
      )}
    </nav>
  );
}
