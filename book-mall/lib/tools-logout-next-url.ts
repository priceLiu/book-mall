import { listPlatformWebOrigins } from "@/lib/platform-web-origins";

/** 校验 federated logout 链上的 `next` 参数，防止开放重定向。 */
export function resolveToolsLogoutNextUrl(
  rawNext: string | null | undefined,
  fallbackUrl: string,
  selfOrigin?: string,
): string {
  const fallback = fallbackUrl.trim() || "/";
  if (!rawNext?.trim()) return fallback;
  try {
    const u = new URL(rawNext.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    const allowed = new Set(listPlatformWebOrigins(selfOrigin));
    if (allowed.has(u.origin.replace(/\/$/, ""))) return u.toString();
  } catch {
    /* invalid URL */
  }
  return fallback;
}
