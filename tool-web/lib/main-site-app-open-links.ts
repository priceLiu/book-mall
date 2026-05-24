/** 经主站过渡页打开 story-web / canvas-web（与 /tools-open 同模式） */

function trimOrigin(raw: string | undefined, fallback: string): string {
  const v = raw?.trim().replace(/\/$/, "");
  return v || fallback;
}

export function getMainSiteOriginForBrowser(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_MAIN_SITE_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://book.ai-code8.com"
      : "http://localhost:3000",
  );
}

function sanitizePath(raw: string, fallback: string): string {
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}

export function mainSiteStoryOpenHref(path = "/"): string {
  const base = getMainSiteOriginForBrowser();
  const p = sanitizePath(path, "/");
  return `${base}/story-open?path=${encodeURIComponent(p)}`;
}

export function mainSiteCanvasOpenHref(path = "/"): string {
  const base = getMainSiteOriginForBrowser();
  const p = sanitizePath(path, "/");
  return `${base}/canvas-open?path=${encodeURIComponent(p)}`;
}
