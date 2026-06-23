/**
 * Gen-HotCold-R3 · Gateway 日志热区（动数据）窗口。
 *
 * 主表 `GatewayRequestLog` 仅保留：在飞 + completedAt 近热窗内的终态。
 * 更老的终态由 `hotcold:archive` 迁入 `GatewayRequestLogArchive`（只读）。
 */
import type { GatewayRequestStatus, Prisma } from "@prisma/client";

export type GatewayLogQueryMode = "live" | "history";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const GATEWAY_INFLIGHT_STATUSES: GatewayRequestStatus[] = ["PENDING", "RUNNING"];

function readPositiveNumber(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey] ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** 主表热保留小时数（默认 1）。本地调试可设 24。 */
export function getGatewayLogHotRetentionHours(): number {
  return readPositiveNumber("GATEWAY_LOG_HOT_RETENTION_HOURS", 1);
}

/** 归档表查询保留天数（财务/盘点，默认 730 天）。 */
export function getGatewayLogArchiveQueryRetentionDays(): number {
  return readPositiveNumber("GATEWAY_LOG_ARCHIVE_QUERY_RETENTION_DAYS", 730);
}

export function gatewayLogHotWindowMs(): number {
  return getGatewayLogHotRetentionHours() * HOUR_MS;
}

export function gatewayLogHotCutoffDate(now = new Date()): Date {
  return new Date(now.getTime() - gatewayLogHotWindowMs());
}

/** 历史 Tab 默认查询窗（无日期时）。 */
export const GATEWAY_HISTORY_DEFAULT_RANGE_DAYS = 31;

export function gatewayHistoryDefaultFromDate(now = new Date()): Date {
  return new Date(now.getTime() - GATEWAY_HISTORY_DEFAULT_RANGE_DAYS * DAY_MS);
}

export function parseGatewayLogQueryMode(
  value: string | null | undefined,
): GatewayLogQueryMode {
  const v = value?.trim().toLowerCase();
  return v === "history" ? "history" : "live";
}

export function isGatewayLogHistoryMode(mode: GatewayLogQueryMode): boolean {
  return mode === "history";
}

/** 热区 WHERE：在飞 OR 近窗终态（completedAt ≥ cutoff）。 */
export function buildGatewayLogHotWhere(
  cutoff: Date = gatewayLogHotCutoffDate(),
): Prisma.GatewayRequestLogWhereInput {
  return {
    OR: [
      { status: { in: GATEWAY_INFLIGHT_STATUSES } },
      { completedAt: { gte: cutoff } },
    ],
  };
}

export function applyGatewayLogQueryMode(
  where: Prisma.GatewayRequestLogWhereInput,
  mode: GatewayLogQueryMode,
): Prisma.GatewayRequestLogWhereInput {
  if (mode === "history") return where;
  const cutoff = gatewayLogHotCutoffDate();
  const hot = buildGatewayLogHotWhere(cutoff);
  if (Object.keys(where).length === 0) return hot;
  return { AND: [where, hot] };
}

/** 投影缓存键后缀，热窗变更时自动隔离旧 bucket。 */
export function gatewayLiveScopeHotSuffix(): string {
  return `hot:${getGatewayLogHotRetentionHours()}h`;
}
