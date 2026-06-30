/** 主站已登录时静默换票（无 tools_token → re-enter）。 */

import { QUICK_REPLICA_SSO_APP } from "@/lib/qr-sso-app";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";

export function buildSilentReEnterHref(
  mainOrigin: string | null,
  redirectPath: string,
  app: typeof QUICK_REPLICA_SSO_APP = QUICK_REPLICA_SSO_APP,
): string | null {
  if (!mainOrigin?.trim()) return null;
  const base = mainOrigin.replace(/\/$/, "");
  const q = new URLSearchParams({ app, redirect: redirectPath });
  return `${base}/api/sso/tools/re-enter?${q}`;
}

export function shouldAttemptSilentSso(opts: {
  hasTokenCookie: boolean;
  sessionActive: boolean;
  loading: boolean;
}): boolean {
  if (isSsoReenterSuppressedClient()) return false;
  if (opts.loading) return false;
  if (opts.hasTokenCookie && opts.sessionActive) return false;
  return true;
}
