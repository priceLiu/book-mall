/**
 * 门户首页 · 匿名可读 GET API（book-mall /api/canvas/*）。
 * 写操作（duplicate / portal-submit / admin）仍须 requireSessionUser。
 */
export const CANVAS_PORTAL_PUBLIC_GET_PATHS = [
  "api/canvas/projects/portal-featured",
  "api/canvas/projects/portal-cases",
  "api/canvas/projects/portal-film-showcase",
  "api/canvas/templates",
  "api/canvas/viewer-session",
] as const;

/** templates GET 仅 scope=public|featured 可匿名；其余 scope 须登录。 */
export function isPublicCanvasTemplatesListScope(scope: string | null | undefined): boolean {
  const s = scope?.trim();
  return s === "public" || s === "featured";
}
