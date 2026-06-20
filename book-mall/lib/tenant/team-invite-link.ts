/** 团队邀请链接（验证码通过 query 带入，受邀人无需再点「获取验证码」）。 */

export function bookMallPublicOrigin(): string {
  return (
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function buildTeamInviteUrl(token: string, code: string): string {
  const q = new URLSearchParams({ code: code.trim() });
  return `${bookMallPublicOrigin()}/invite/t/${encodeURIComponent(token)}?${q.toString()}`;
}

/**
 * 优先使用 DB 中最新 urlCode（避免旧短信 query 中过期 code 覆盖新链接）。
 */
export function pickTeamInviteUrlCode(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  storedUrlCode: string | null | undefined,
): string | null {
  const stored = storedUrlCode?.trim();
  if (stored) return stored;
  const raw = searchParams?.code;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  const q = fromQuery?.trim();
  return q || null;
}
