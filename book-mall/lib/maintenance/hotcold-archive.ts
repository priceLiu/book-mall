/**
 * Gen-HotCold-R2 Phase 5A · 大表静化（轻量归档）。
 *
 * 把「终态且过保留期」的 GatewayRequestLog、「过保留期」的 CreditLedger 批量搬迁到归档表，
 * 主表只留「在飞 + 近期」热数据，使 poll/聚合/报表不被历史拖累。
 *
 * 数据完整性：每批「INSERT INTO 归档 SELECT … ON CONFLICT DO NOTHING」+「DELETE 主表」
 * 放在同一事务，要么都成功要么都回滚，绝不丢数据；按 id 幂等，可重复运行。
 *
 * 注意（账本）：CreditLedger 归档保留期须足够长（默认 365 天），确保不会删除仍可能
 * 被幂等重试命中的 idempotencyKey（重试均在分钟/小时级，不会跨月）。余额真相在
 * CreditAccount，不依赖账本重算，故搬迁历史账本不影响余额。
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const GATEWAY_TERMINAL_STATUSES = ["SUCCEEDED", "FAILED", "CANCELLED"] as const;

export interface ArchiveOptions {
  retentionDays: number;
  batchSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
}

export interface ArchiveResult {
  table: string;
  cutoff: string;
  candidateSample: number;
  moved: number;
  batches: number;
  dryRun: boolean;
}

export async function archiveGatewayLogs(
  opts: ArchiveOptions,
): Promise<ArchiveResult> {
  const batchSize = opts.batchSize ?? 1000;
  const maxBatches = opts.maxBatches ?? 100;
  const dryRun = opts.dryRun ?? false;
  const cutoff = new Date(Date.now() - opts.retentionDays * 86_400_000);

  let moved = 0;
  let batches = 0;
  let candidateSample = 0;

  for (let i = 0; i < maxBatches; i++) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "GatewayRequestLog"
      WHERE "status" IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
        AND "completedAt" IS NOT NULL
        AND "completedAt" < ${cutoff}
      ORDER BY "completedAt" ASC
      LIMIT ${batchSize}`;
    if (rows.length === 0) break;
    candidateSample += rows.length;

    if (dryRun) {
      batches++;
      if (rows.length < batchSize) break;
      continue;
    }

    const ids = rows.map((r) => r.id);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "GatewayRequestLogArchive"
        SELECT g.*, CURRENT_TIMESTAMP
        FROM "GatewayRequestLog" g
        WHERE g."id" IN (${Prisma.join(ids)})
        ON CONFLICT ("id") DO NOTHING`;
      await tx.$executeRaw`
        DELETE FROM "GatewayRequestLog"
        WHERE "id" IN (${Prisma.join(ids)})`;
    });
    moved += ids.length;
    batches++;
    if (rows.length < batchSize) break;
  }

  return {
    table: "GatewayRequestLog",
    cutoff: cutoff.toISOString(),
    candidateSample,
    moved,
    batches,
    dryRun,
  };
}

export async function archiveCreditLedger(
  opts: ArchiveOptions,
): Promise<ArchiveResult> {
  const batchSize = opts.batchSize ?? 1000;
  const maxBatches = opts.maxBatches ?? 100;
  const dryRun = opts.dryRun ?? false;
  const cutoff = new Date(Date.now() - opts.retentionDays * 86_400_000);

  let moved = 0;
  let batches = 0;
  let candidateSample = 0;

  for (let i = 0; i < maxBatches; i++) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "CreditLedger"
      WHERE "createdAt" < ${cutoff}
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}`;
    if (rows.length === 0) break;
    candidateSample += rows.length;

    if (dryRun) {
      batches++;
      if (rows.length < batchSize) break;
      continue;
    }

    const ids = rows.map((r) => r.id);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "CreditLedgerArchive"
        SELECT c.*, CURRENT_TIMESTAMP
        FROM "CreditLedger" c
        WHERE c."id" IN (${Prisma.join(ids)})
        ON CONFLICT ("id") DO NOTHING`;
      await tx.$executeRaw`
        DELETE FROM "CreditLedger"
        WHERE "id" IN (${Prisma.join(ids)})`;
    });
    moved += ids.length;
    batches++;
    if (rows.length < batchSize) break;
  }

  return {
    table: "CreditLedger",
    cutoff: cutoff.toISOString(),
    candidateSample,
    moved,
    batches,
    dryRun,
  };
}
