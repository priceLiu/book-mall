export function getAppPublicOrigin(): string | null {
  const raw =
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

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

export function getBookAccountUrl(): string | null {
  const origin = getMainSiteOrigin();
  return origin ? `${origin.replace(/\/$/, "")}/account` : null;
}

export function getBookPricingUrl(): string | null {
  const origin = getMainSiteOrigin();
  return origin ? `${origin.replace(/\/$/, "")}/pricing` : null;
}
