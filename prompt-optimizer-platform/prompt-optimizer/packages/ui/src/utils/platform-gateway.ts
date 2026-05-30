/** UI 层平台 Gateway 模式检测（与 core VITE_PLATFORM_GATEWAY 一致）。 */

export function isPlatformGatewayMode(): boolean {
  try {
    const v = String(import.meta.env.VITE_PLATFORM_GATEWAY ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  } catch {
    return false;
  }
}

export function getPlatformGatewayManageUrl(): string {
  const raw = String(import.meta.env.VITE_GATEWAY_WEB_ORIGIN ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname === "localhost") return `${protocol}//${hostname}:3005`;
  }
  return "http://localhost:3005";
}
