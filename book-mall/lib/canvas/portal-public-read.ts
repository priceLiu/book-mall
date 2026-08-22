/**
 * 门户首页 · 匿名可读 GET API（book-mall /api/canvas/*）。
 * 首页 portal 列表已改静态快照；此处保留 viewer-session 与 templates scope 供非首页入口。
 */
export const CANVAS_PORTAL_PUBLIC_GET_PATHS = [
  "api/canvas/viewer-session",
  "api/canvas/templates",
  "api/public/static-snapshots/canvas-home",
] as const;

/** templates GET 仅 scope=public|featured 可匿名；其余 scope 须登录。 */
export function isPublicCanvasTemplatesListScope(scope: string | null | undefined): boolean {
  const s = scope?.trim();
  return s === "public" || s === "featured";
}
