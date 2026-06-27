/** SSO exchange 刚完成：短时禁止 RequireAuth 再次静默 re-enter（避免 canvas-open 后双换票）。 */

export const SSO_EXCHANGE_FRESH_COOKIE = "sso_exchange_fresh";

const DEFAULT_MAX_AGE_SEC = 90;

export function buildSetSsoExchangeFreshCookieHeader(
  maxAgeSec = DEFAULT_MAX_AGE_SEC,
  secure = process.env.NODE_ENV === "production",
): string {
  const parts = [
    `${SSO_EXCHANGE_FRESH_COOKIE}=1`,
    "Path=/",
    `Max-Age=${maxAgeSec}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function isSsoExchangeFreshClient(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sso_exchange_fresh=1(?:;|$)/.test(document.cookie);
}

export function clearSsoExchangeFreshClient(): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${SSO_EXCHANGE_FRESH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
