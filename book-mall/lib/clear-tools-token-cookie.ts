/** 清除子站 SSO 令牌 Cookie（localhost 各端口共享 host，须与 full-signout 一并清理）。 */

export const TOOLS_TOKEN_COOKIE_NAME = "tools_token";

export function buildClearToolsTokenCookieHeader(secure: boolean): string {
  const parts = [
    `${TOOLS_TOKEN_COOKIE_NAME}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
