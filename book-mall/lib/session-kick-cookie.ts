/** 非 HttpOnly：仅当 sessionVersion 不一致被挤下线时写入，供客户端弹窗判定。 */

export const SESSION_KICK_COOKIE = "bm_session_kicked";

export function sessionKickCookieHeader(): string {
  return `${SESSION_KICK_COOKIE}=1; Path=/; Max-Age=120; SameSite=Lax`;
}

export function clearSessionKickCookieHeader(): string {
  return `${SESSION_KICK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readSessionKickCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${SESSION_KICK_COOKIE}=1`));
}

export function clearSessionKickCookieClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = clearSessionKickCookieHeader();
}
