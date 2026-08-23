/** 子应用 SSO `app=` 与 Book re-enter 一致。 */
export type PortalBookAuthApp =
  | "tool"
  | "canvas"
  | "story"
  | "prompt-optimizer"
  | "quick-replica"
  | "e-commerce"
  | "director"
  | "common-tools"
  | "publisher";

export function sanitizePortalRedirectPath(raw: string, fallback = "/"): string {
  const path = raw?.trim() || fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

export function buildBookPortalReEnterQuery(
  app: PortalBookAuthApp,
  redirectPath: string,
): string {
  const redirect = sanitizePortalRedirectPath(redirectPath);
  const params = new URLSearchParams({ redirect });
  if (app !== "tool") params.set("app", app);
  return params.toString();
}

/** 已登录 Book 时静默换票入口。 */
export function buildBookPortalReEnterHref(
  bookOrigin: string,
  app: PortalBookAuthApp,
  redirectPath = "/",
): string {
  const book = bookOrigin.replace(/\/$/, "");
  const q = buildBookPortalReEnterQuery(app, redirectPath);
  return `${book}/api/sso/tools/re-enter?${q}`;
}

/** 未登录：跳转 Book 登录，成功后经 re-enter 回子应用。 */
export function buildBookPortalLoginHref(
  bookOrigin: string,
  app: PortalBookAuthApp,
  redirectPath = "/",
): string {
  const book = bookOrigin.replace(/\/$/, "");
  const q = buildBookPortalReEnterQuery(app, redirectPath);
  const callbackUrl = `/api/sso/tools/re-enter?${q}`;
  return `${book}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function buildBookPortalRegisterHref(
  bookOrigin: string,
  app: PortalBookAuthApp,
  redirectPath = "/",
): string {
  const book = bookOrigin.replace(/\/$/, "");
  const q = buildBookPortalReEnterQuery(app, redirectPath);
  const callbackUrl = `/api/sso/tools/re-enter?${q}`;
  return `${book}/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
