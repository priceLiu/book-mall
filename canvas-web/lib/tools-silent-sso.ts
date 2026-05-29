/** 主站已登录时静默换票（无 tools_token → re-enter）。 */

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
  if (opts.loading) return false;
  if (opts.hasTokenCookie && opts.sessionActive) return false;
  return true;
}
