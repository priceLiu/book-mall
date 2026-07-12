function normalizeHttpOriginUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

export function getMainSiteOrigin(): string | null {
  const raw =
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    process.env.BOOK_MALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u?.origin ?? null;
}

/** 主站个人中心（全站统一入口，子门户不承载独立账户页） */
export function getBookAccountUrl(): string | null {
  const origin = getMainSiteOrigin();
  return origin ? `${origin.replace(/\/$/, "")}/account` : null;
}

export function getAppPublicOrigin(): string | null {
  const raw =
    process.env.ECOMMERCE_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u?.origin ?? null;
}
