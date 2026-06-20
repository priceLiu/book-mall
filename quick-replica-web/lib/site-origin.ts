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

export function getAppPublicOrigin(): string | null {
  const raw =
    process.env.QUICK_REPLICA_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u?.origin ?? null;
}

export function getGatewayWebOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_GATEWAY_WEB_ORIGIN?.trim() ||
    process.env.GATEWAY_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u?.origin ?? null;
}
