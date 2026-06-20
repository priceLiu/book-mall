/** Gateway 日志列表 · 查询参数解析 */

import type { GatewayRequestStatus } from "@prisma/client";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const VALID_LOG_STATUSES = new Set<GatewayRequestStatus>([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const DASHBOARD_HOURS_PRESETS = [1, 3, 6, 12] as const;

export function parseDashboardHoursParam(
  value: string | null | undefined,
): number | undefined {
  const n = Number(value?.trim());
  if (!Number.isFinite(n)) return undefined;
  return (DASHBOARD_HOURS_PRESETS as readonly number[]).includes(n)
    ? n
    : undefined;
}

export function parseLogStatusesParam(
  value: string | null | undefined,
): GatewayRequestStatus[] | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is GatewayRequestStatus =>
      VALID_LOG_STATUSES.has(s as GatewayRequestStatus),
    );
  return parsed.length > 0 ? parsed : undefined;
}

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
