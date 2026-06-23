/**
 * Gen-HotCold-R2 Phase 5A · 报表读路由（主表 / 归档表）。
 *
 * 路由规则（默认）：
 *  - 查询时间范围完全落在保留期内（from ≥ now-retention）→ 只读主表（热）。
 *  - 范围跨越保留边界（from < now-retention）→ 主表 + 归档表合并。
 *
 * 归档表与主表字段同构（见 schema GatewayRequestLogArchive / CreditLedgerArchive），
 * 故合并后行形状一致；归档行多出 archivedAt（读取时忽略）。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const DEFAULT_GATEWAY_LOG_RETENTION_DAYS = 90;
export const DEFAULT_CREDIT_LEDGER_RETENTION_DAYS = 365;

/** 给定查询下界与保留天数，是否需要并读归档表。 */
export function needsArchive(
  from: Date | null | undefined,
  retentionDays: number,
  now: Date = new Date(),
): boolean {
  if (!from) return true; // 无下界 = 可能查到很早 → 需归档
  const boundary = new Date(now.getTime() - retentionDays * 86_400_000);
  return from.getTime() < boundary.getTime();
}

/**
 * 按时间范围读取 Gateway 日志（必要时合并归档表）。
 * 用于历史报表/导出；实时仪表盘仍只读主表热数据。
 */
export async function findGatewayLogsByTimeRange(args: {
  where: Prisma.GatewayRequestLogWhereInput;
  from?: Date | null;
  retentionDays?: number;
  take?: number;
}): Promise<Array<Record<string, unknown>>> {
  const retentionDays =
    args.retentionDays ?? DEFAULT_GATEWAY_LOG_RETENTION_DAYS;
  const take = args.take ?? 1000;

  const main = await prisma.gatewayRequestLog.findMany({
    where: args.where,
    orderBy: { submittedAt: "desc" },
    take,
  });

  if (!needsArchive(args.from, retentionDays)) {
    return main as Array<Record<string, unknown>>;
  }

  const archived = await prisma.gatewayRequestLogArchive.findMany({
    where: args.where as Prisma.GatewayRequestLogArchiveWhereInput,
    orderBy: { submittedAt: "desc" },
    take,
  });

  return [...main, ...archived] as Array<Record<string, unknown>>;
}
