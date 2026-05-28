function normalizeHttpOriginUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const m = u.pathname.match(/^\/:(\d+)\/?$/);
    if (m && !u.port) {
      u.port = m[1];
      u.pathname = "/";
    }
    return u;
  } catch {
    return null;
  }
}

export function getMainSiteOrigin(): string | null {
  const raw =
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.BOOK_MALL_URL?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u?.origin ?? null;
}

/** 浏览器访问 story-web 的 Origin。 */
export function getAppPublicOrigin(): string | null {
  const raw =
    process.env.STORY_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u?.origin ?? null;
}
