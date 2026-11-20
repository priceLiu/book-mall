/** /dev 全链路压测等项目 · 不在「我的画布」列表展示 */
export const CANVAS_DEV_LOAD_TEST_NAME_PREFIX = "[全链路并发]";

export function isHiddenDevCanvasListProject(row: {
  name: string | null;
  description?: string | null;
  meta?: unknown;
}): boolean {
  const name = (row.name ?? "").trim();
  if (name.startsWith(CANVAS_DEV_LOAD_TEST_NAME_PREFIX)) return true;
  const meta =
    row.meta && typeof row.meta === "object"
      ? (row.meta as Record<string, unknown>)
      : null;
  if (meta?.devGenLoadTest === true) return true;
  return false;
}