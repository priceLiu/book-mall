/**
 * 门户首页 · 匿名可读 GET API（book-mall /api/canvas/*）。
 * canvas-web BFF 代理须与 `book-mall-portal-public-proxy.ts` 保持一致。
 */
export const CANVAS_PORTAL_PUBLIC_GET_PATHS = [
  "api/canvas/viewer-session",
  "api/canvas/templates",
  "api/public/static-snapshots/canvas-home",
  "api/canvas/projects/portal-featured",
  "api/canvas/projects/portal-cases",
  "api/canvas/projects/portal-film-showcase",
] as const;

/** templates GET 仅 scope=public|featured 可匿名；其余 scope 须登录。 */
export function isPublicCanvasTemplatesListScope(scope: string | null | undefined): boolean {
  const s = scope?.trim();
  return s === "public" || s === "featured";
}
