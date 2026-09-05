/** 距 exp 不足该秒数时主动续签（JWT 默认 TTL 600s） */
export const TOOLS_JWT_REFRESH_WITHIN_SEC = 180;

export function readJwtExpSec(token: string): number | null {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;
    let b = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const payload = JSON.parse(Buffer.from(b, "base64").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** 解析 tools_token JWT 是否已过期 */
export function isToolsJwtExpired(token: string, skewSec = 30): boolean {
  const exp = readJwtExpSec(token);
  if (exp == null) return true;
  return exp * 1000 <= Date.now() + skewSec * 1000;
}

export function toolsJwtSecondsUntilExpiry(token: string): number {
  const exp = readJwtExpSec(token);
  if (exp == null) return 0;
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}

export function shouldRefreshToolsJwt(
  token: string,
  withinSec = TOOLS_JWT_REFRESH_WITHIN_SEC,
): boolean {
  if (!token.trim()) return true;
  if (isToolsJwtExpired(token)) return true;
  return toolsJwtSecondsUntilExpiry(token) <= withinSec;
}
