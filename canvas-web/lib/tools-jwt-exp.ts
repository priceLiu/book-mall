/** 距 exp 不足该秒数时主动续签（JWT 默认 TTL 600s） */
export const TOOLS_JWT_REFRESH_WITHIN_SEC = 180;

/** 解析 tools_token JWT 是否已过期（与 BFF ensureProxyToolsBearer 口径一致） */
export function isToolsJwtExpired(token: string, skewSec = 30): boolean {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number") return true;
    return payload.exp * 1000 <= Date.now() + skewSec * 1000;
  } catch {
    return true;
  }
}

/** JWT 剩余有效秒数；无法解析时返回 0 */
export function toolsJwtSecondsUntilExpiry(token: string): number {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number") return 0;
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
}

/** 令牌已过期或即将过期（须静默续签） */
export function shouldRefreshToolsJwt(
  token: string,
  withinSec = TOOLS_JWT_REFRESH_WITHIN_SEC,
): boolean {
  if (!token.trim()) return true;
  if (isToolsJwtExpired(token)) return true;
  return toolsJwtSecondsUntilExpiry(token) <= withinSec;
}
