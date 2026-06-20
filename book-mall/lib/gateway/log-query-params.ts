/** Gateway 日志列表 · 查询参数解析 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const GATEWAY_LOG_PAGE_SIZE_DEFAULT = 20;
export const GATEWAY_LOG_PAGE_SIZE_MAX = 500;
export const GATEWAY_LOG_PAGE_SIZE_PRESETS = [20, 50, 100] as const;

export function parseLogPageParam(value: string | null | undefined): number {
  const n = Number(value ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function parseLogLimitParam(
  value: string | null | undefined,
  fallback = GATEWAY_LOG_PAGE_SIZE_DEFAULT,
): number {
  const n = Number(value ?? String(fallback));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(GATEWAY_LOG_PAGE_SIZE_MAX, Math.floor(n));
}

export function computeLogTotalPages(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** 开始日期（含当日 00:00:00.000 UTC） */
export function parseLogSubmittedFromParam(
  value: string | null | undefined,
): Date | undefined {
  const v = value?.trim();
  if (!v || !DATE_ONLY.test(v)) return undefined;
  return new Date(`${v}T00:00:00.000Z`);
}

/** 结束日期（含当日 23:59:59.999 UTC） */
export function parseLogSubmittedToParam(
  value: string | null | undefined,
): Date | undefined {
  const v = value?.trim();
  if (!v || !DATE_ONLY.test(v)) return undefined;
  return new Date(`${v}T23:59:59.999Z`);
}
