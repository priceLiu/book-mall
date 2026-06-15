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
