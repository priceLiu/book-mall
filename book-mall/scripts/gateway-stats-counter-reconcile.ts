#!/usr/bin/env tsx
/**
 * Gen-HotCold-R2 Phase 2 · Gateway 状态投影计数纠偏。
 *
 * - 重算 global 在飞/终态卡片（真相 = GatewayRequestLog 全量），覆盖写回投影行。
 * - global.queued = canvas + story 处于 QUEUED/DISPATCHING（尚无 Gateway 日志）的任务数。
 * - 清理过期的 dashboard 签名缓存行（computedAt 早于保留期）。
 *
 * 用法：
 *   pnpm --dir book-mall gateway:stats-reconcile            # 执行
 *   pnpm --dir book-mall gateway:stats-reconcile -- --dry-run
 */
import { computeDashboardSummaryCards } from "@/lib/gateway/log-dashboard-projection";
import {
  GATEWAY_STATS_GLOBAL_SCOPE,
  GATEWAY_STATS_LIVE_BUCKET,
  reconcileGatewayStatsCounter,
} from "@/lib/gateway/stats-counter";
import { prisma } from "@/lib/prisma";

const QUEUED_STATUSES = ["QUEUED", "DISPATCHING"] as const;
/** 签名缓存行保留期：超过则视为陈旧（无人再看的过滤视图），清理。 */
const SIGNATURE_ROW_TTL_MS = 24 * 60 * 60 * 1000;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const [cards, canvasQueued, storyQueued] = await Promise.all([
    computeDashboardSummaryCards({}),
    prisma.canvasGenerationTask.count({
      where: { status: { in: [...QUEUED_STATUSES] } },
    }),
    prisma.storyGenerationTask.count({
      where: { status: { in: [...QUEUED_STATUSES] } },
    }),
  ]);
  const queued = canvasQueued + storyQueued;

  const before = await prisma.gatewayStatsCounter.findUnique({
    where: {
      scopeKey_bucket: {
        scopeKey: GATEWAY_STATS_GLOBAL_SCOPE,
        bucket: GATEWAY_STATS_LIVE_BUCKET,
      },
    },
  });

  // 清理陈旧签名缓存（保留 global）。
  const staleCutoff = new Date(Date.now() - SIGNATURE_ROW_TTL_MS);
  const staleCount = await prisma.gatewayStatsCounter.count({
    where: {
      scopeKey: { not: GATEWAY_STATS_GLOBAL_SCOPE },
      computedAt: { lt: staleCutoff },
    },
  });

  const report = {
    dryRun,
    global: {
      before: before
        ? {
            inProgress: before.inProgress,
            succeeded: before.succeeded,
            failed: before.failed,
            cancelled: before.cancelled,
            queued: before.queued,
          }
        : null,
      after: { ...cards, queued },
    },
    staleSignatureRowsToDelete: staleCount,
  };

  if (!dryRun) {
    await reconcileGatewayStatsCounter(GATEWAY_STATS_GLOBAL_SCOPE, cards, queued);
    await prisma.gatewayStatsCounter.deleteMany({
      where: {
        scopeKey: { not: GATEWAY_STATS_GLOBAL_SCOPE },
        computedAt: { lt: staleCutoff },
      },
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
