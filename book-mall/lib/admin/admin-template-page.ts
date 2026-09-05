/** 模板管理列表：首屏条数，滚动再取下一页 */
export const ADMIN_TEMPLATE_PAGE_SIZE = 20;

export function parseAdminListPage(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} {
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, rawLimit))
    : ADMIN_TEMPLATE_PAGE_SIZE;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  return { limit, offset };
}

export function sliceAdminPage<T>(
  items: T[],
  offset: number,
  limit: number,
): { items: T[]; total: number } {
  const start = Math.max(0, offset);
  const size = Math.min(100, Math.max(1, limit));
  return { items: items.slice(start, start + size), total: items.length };
}
