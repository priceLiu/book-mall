/** 子应用 / 主站 middleware 上报目标 Book Origin（复用 SSO / NextAuth 已有变量） */

export function resolveBookMallOrigin(): string | null {
  const candidates = [
    process.env.MAIN_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_BOOK_MALL_URL,
    process.env.NEXT_PUBLIC_MAIN_SITE_ORIGIN,
    process.env.BOOK_MALL_URL,
    process.env.BOOK_MALL_ORIGIN,
    process.env.NEXTAUTH_URL,
  ];
  for (const raw of candidates) {
    const s = raw?.trim();
    if (!s) continue;
    try {
      return new URL(s).origin;
    } catch {
      /* try next */
    }
  }
  return null;
}
