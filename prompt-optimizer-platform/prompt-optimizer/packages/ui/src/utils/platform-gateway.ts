/** UI 层平台 Gateway 模式检测（与 core VITE_PLATFORM_GATEWAY 一致）。 */

export const PLATFORM_GATEWAY_CONFIG_ID = "platform-gateway/default";

declare global {
  interface Window {
    runtime_config?: Record<string, unknown>;
  }
}

export function isPlatformGatewayMode(): boolean {
  try {
    if (typeof window !== "undefined" && window.runtime_config) {
      const rc = window.runtime_config;
      const runtimeValue = String(
        rc.PLATFORM_GATEWAY ?? rc.VITE_PLATFORM_GATEWAY ?? "",
      )
        .trim()
        .toLowerCase();
      if (runtimeValue === "1" || runtimeValue === "true" || runtimeValue === "yes") {
        return true;
      }
    }
    const v = String(import.meta.env.VITE_PLATFORM_GATEWAY ?? "")
      .trim()
      .toLowerCase();
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
