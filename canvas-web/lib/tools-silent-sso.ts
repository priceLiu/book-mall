/** 主站已登录时静默换票（无 tools_token → re-enter）。 */

import { isSsoExchangeFreshClient } from "@/lib/sso-exchange-fresh";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";

export function buildSilentReEnterHref(
  mainOrigin: string | null,
  redirectPath: string,
  app: "tool" | "canvas" | "story" = "canvas",
): string | null {
  if (!mainOrigin?.trim()) return null;
  const base = mainOrigin.replace(/\/$/, "");
  const q = new URLSearchParams({ redirect: redirectPath });
  if (app !== "tool") q.set("app", app);
  return `${base}/api/sso/tools/re-enter?${q}`;
}

export function shouldAttemptSilentSso(opts: {
  hasTokenCookie: boolean;
  sessionActive: boolean;
  loading: boolean;
}): boolean {
  if (isSsoReenterSuppressedClient()) return false;
  /** exchange 刚落 cookie 时 introspect 可能因冷启动失败，先重试验票而非立刻再 re-enter */
  if (isSsoExchangeFreshClient()) return false;
  if (opts.loading) return false;
  if (opts.hasTokenCookie && opts.sessionActive) return false;
  return true;
}
