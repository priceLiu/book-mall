/** 退出后短时禁止子站静默 re-enter（localhost 各端口共享 host）。 */

export const SSO_REENTER_SUPPRESS_COOKIE = "sso_reenter_suppress";

export function buildSetSsoReenterSuppressCookieHeader(
  maxAgeSec = 300,
  secure = process.env.NODE_ENV === "production",
): string {
  const parts = [
    `${SSO_REENTER_SUPPRESS_COOKIE}=1`,
    "Path=/",
    `Max-Age=${maxAgeSec}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearSsoReenterSuppressCookieHeader(
  secure = process.env.NODE_ENV === "production",
): string {
  const parts = [
    `${SSO_REENTER_SUPPRESS_COOKIE}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** 客户端：退出 / 换账号前写入，避免 canvas 等子站立刻静默换票。 */
export function markSsoReenterSuppressed(maxAgeSec = 300): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${SSO_REENTER_SUPPRESS_COOKIE}=1; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function clearSsoReenterSuppress(): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${SSO_REENTER_SUPPRESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function isSsoReenterSuppressedClient(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sso_reenter_suppress=1(?:;|$)/.test(document.cookie);
}
