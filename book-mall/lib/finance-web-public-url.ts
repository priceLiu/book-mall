/** 与 `lib/sso-tools-env.normalizeHttpOriginUrl` 同规则，避免控制台误填端口路径。 */
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

/**
 * finance-web 公网 Origin（无末尾 `/`）。
 * 个人中心外链使用 `NEXT_PUBLIC_*`，与 tool-web 的 `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` 保持一致。
 */
export function getFinanceWebPublicOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_FINANCE_WEB_ORIGIN?.trim();
  if (!raw) return null;
  const u = normalizeHttpOriginUrl(raw);
  return u ? u.origin : null;
}
