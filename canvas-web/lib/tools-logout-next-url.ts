/** 与 book-mall/lib/platform-web-origins.ts LOCAL_PLATFORM_WEB_ORIGINS 保持一致。 */
const LOCAL_PLATFORM_WEB_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3006",
  "http://localhost:3007",
] as const;

function trimOrigin(raw: string | null | undefined): string | null {
  const v = raw?.trim().replace(/\/$/, "");
  return v && v.startsWith("http") ? v : null;
}

function collectAllowedOrigins(selfOrigin?: string): Set<string> {
  const allowed = new Set<string>();
  for (const raw of [
    process.env.MAIN_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_BOOK_MALL_URL,
    process.env.TOOLS_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_TOOL_WEB_ORIGIN,
    process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN,
    process.env.CANVAS_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN,
    process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN,
    process.env.PROMPT_OPTIMIZER_PUBLIC_ORIGIN,
    process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN,
    process.env.ECOMMERCE_PUBLIC_ORIGIN,
    selfOrigin,
  ]) {
    const o = trimOrigin(raw);
    if (o) allowed.add(o);
  }
  if (process.env.NODE_ENV !== "production") {
    for (const o of LOCAL_PLATFORM_WEB_ORIGINS) allowed.add(o);
  }
  return allowed;
}

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
    const allowed = collectAllowedOrigins(selfOrigin);
    if (allowed.has(u.origin.replace(/\/$/, ""))) return u.toString();
  } catch {
    /* invalid URL */
  }
  return fallback;
}

export function appendSsoReenterSuppressCookie(res: {
  headers: Headers;
}): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = ["sso_reenter_suppress=1", "Path=/", "Max-Age=300", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  res.headers.append("Set-Cookie", parts.join("; "));
}

export function isSsoReenterSuppressedClient(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sso_reenter_suppress=1(?:;|$)/.test(document.cookie);
}
