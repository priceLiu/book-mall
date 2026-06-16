/** Phase B：主站已登录时静默换票（无 tools_token → re-enter）。 */

import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";

export function buildSilentReEnterHref(
  mainOrigin: string | null,
  redirectPath: string,
  app: "tool" | "canvas" | "story" = "tool",
): string | null {
  if (!mainOrigin?.trim()) return null;
  const base = mainOrigin.replace(/\/$/, "");
  const q = new URLSearchParams({ redirect: redirectPath });
  if (app !== "tool") q.set("app", app);
  return `${base}/api/sso/tools/re-enter?${q}`;
}

/** 是否应对当前路径尝试静默换票（公开页跳过）。 */
export function shouldAttemptSilentSso(opts: {
  hasTokenCookie: boolean;
  sessionActive: boolean;
  loading: boolean;
  isPublicPath: boolean;
}): boolean {
  if (isSsoReenterSuppressedClient()) return false;
  if (opts.isPublicPath) return false;
  if (opts.loading) return false;
  if (opts.hasTokenCookie && opts.sessionActive) return false;
  return true;
}
