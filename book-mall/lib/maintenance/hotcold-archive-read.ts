/**
 * Gen-HotCold-R2/R3 · 报表读路由（主表 / 归档表）。
 *
 * R3：主表热保留改为小时级（默认 1h）；history 模式并读归档表。
 */
import type { GatewayRequestLog, Prisma } from "@prisma/client";

import {
  getGatewayLogHotRetentionHours,
  type GatewayLogQueryMode,
} from "@/lib/gateway/gateway-hot-window";
import { prisma } from "@/lib/prisma";

/** @deprecated R3 主表热保留请用 `getGatewayLogHotRetentionHours()` */
export const DEFAULT_GATEWAY_LOG_RETENTION_DAYS = 90;
export const DEFAULT_CREDIT_LEDGER_RETENTION_DAYS = 365;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** 给定查询下界与热保留小时数，是否需要并读归档表。 */
export function needsArchiveByHotHours(
  from: Date | null | undefined,
  hotRetentionHours: number,
  now: Date = new Date(),
): boolean {
  if (!from) return true;
  const boundary = new Date(now.getTime() - hotRetentionHours * HOUR_MS);
  return from.getTime() < boundary.getTime();
}

/** @deprecated 使用 needsArchiveByHotHours；保留供旧报表路径。 */
export function needsArchive(
  from: Date | null | undefined,
  retentionDays: number,
  now: Date = new Date(),
): boolean {
  if (!from) return true;
  const boundary = new Date(now.getTime() - retentionDays * DAY_MS);
  return from.getTime() < boundary.getTime();
}

function archiveWhere(
  where: Prisma.GatewayRequestLogWhereInput,
): Prisma.GatewayRequestLogArchiveWhereInput {
  return where as Prisma.GatewayRequestLogArchiveWhereInput;
}

export async function countGatewayLogsMerged(
  where: Prisma.GatewayRequestLogWhereInput,
  mode: GatewayLogQueryMode,
): Promise<number> {
  if (mode === "live") {
    return prisma.gatewayRequestLog.count({ where });
  }
  const [main, archived] = await Promise.all([
    prisma.gatewayRequestLog.count({ where }),
    prisma.gatewayRequestLogArchive.count({ where: archiveWhere(where) }),
  ]);
  return main + archived;
}

function sortGatewayLogsBySubmittedAtDesc(
  rows: GatewayRequestLog[],
): GatewayRequestLog[] {
  return rows.sort((a, b) => {
    const diff = b.submittedAt.getTime() - a.submittedAt.getTime();
    if (diff !== 0) return diff;
    return a.id < b.id ? 1 : -1;
  });
}

export async function findGatewayLogsMerged(args: {
  where: Prisma.GatewayRequestLogWhereInput;
  mode: GatewayLogQueryMode;
  skip?: number;
  take?: number;
  orderBy?: Prisma.GatewayRequestLogOrderByWithRelationInput;
}): Promise<GatewayRequestLog[]> {
  const skip = args.skip ?? 0;
  const take = args.take ?? 20;
  const orderBy = args.orderBy ?? { submittedAt: "desc" };

  if (args.mode === "live") {
    return prisma.gatewayRequestLog.findMany({
      where: args.where,
      orderBy,
      skip,
      take,
    });
  }

  const fetchLimit = skip + take;
  const [mainRows, archivedRows] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where: args.where,
      orderBy,
      take: fetchLimit,
    }),
    prisma.gatewayRequestLogArchive.findMany({
      where: archiveWhere(args.where),
      orderBy,
      take: fetchLimit,
    }),
  ]);

  const byId = new Map<string, GatewayRequestLog>();
  for (const row of mainRows) byId.set(row.id, row);
  for (const row of archivedRows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row as GatewayRequestLog);
    }
  }
  return sortGatewayLogsBySubmittedAtDesc([...byId.values()]).slice(
    skip,
    skip + take,
  );
}

export async function findGatewayLogByIdMerged(
  id: string,
): Promise<GatewayRequestLog | null> {
  const main = await prisma.gatewayRequestLog.findUnique({ where: { id } });
  if (main) return main;
  const archived = await prisma.gatewayRequestLogArchive.findUnique({
    where: { id },
  });
  return archived as GatewayRequestLog | null;
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
  const hotHours = getGatewayLogHotRetentionHours();
  const take = args.take ?? 1000;
  const from = args.from;
  const useArchive =
    needsArchiveByHotHours(from, hotHours) ||
    needsArchive(from, args.retentionDays ?? DEFAULT_GATEWAY_LOG_RETENTION_DAYS);

  const main = await prisma.gatewayRequestLog.findMany({
    where: args.where,
    orderBy: { submittedAt: "desc" },
    take,
  });

  if (!useArchive) {
    return main as Array<Record<string, unknown>>;
  }

  const archived = await prisma.gatewayRequestLogArchive.findMany({
    where: archiveWhere(args.where),
    orderBy: { submittedAt: "desc" },
    take,
  });

  return [...main, ...archived] as Array<Record<string, unknown>>;
}
