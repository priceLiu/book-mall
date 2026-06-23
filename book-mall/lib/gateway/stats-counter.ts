/**
 * Gen-HotCold-R2 Phase 2 · Gateway 状态投影计数。
 *
 * 设计（动静分离）：
 *  - `global` 行：createRequestLog / finalize 翻转时增量 bump，维持「在飞」实时口径。
 *  - 任意 scope 行：作为**短 TTL 自愈缓存**——`computedAt` 过期即触发一次全量重算并回填，
 *    并发轮询共享同一快照，避免每次都对 GatewayRequestLog 全表 groupBy。
 *
 * 正确性：重算（recompute）始终是权威值；增量 bump 仅在两次重算之间保持新鲜。
 * 计数与真相（GatewayRequestLog）若漂移，由 TTL 重算 + `gateway-stats-counter-reconcile.ts` 纠偏。
 * 所有写入均为 best-effort：失败只记日志，绝不阻断生成主流程。
 */
import type { GatewayRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { DashboardCards } from "@/lib/gateway/log-dashboard-projection";

export const GATEWAY_STATS_GLOBAL_SCOPE = "global";
export const GATEWAY_STATS_LIVE_BUCKET = "live";
/** dashboard 读投影默认 TTL：并发轮询在该窗口内共享同一快照 */
export const GATEWAY_STATS_DEFAULT_TTL_MS = 4_000;

export type GatewayStatusBucket =
  | "inProgress"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "queued";

const BUCKET_COLUMNS: Record<GatewayStatusBucket, string> = {
  inProgress: "inProgress",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  queued: "queued",
};

/** GatewayRequestLog.status → 计数桶。 */
export function gatewayStatusToBucket(
  status: GatewayRequestStatus | string,
): GatewayStatusBucket {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    case "PENDING":
    case "RUNNING":
    default:
      return "inProgress";
  }
}

export interface StatusCounts {
  inProgress: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  queued: number;
}

export function emptyStatusCounts(): StatusCounts {
  return { inProgress: 0, succeeded: 0, failed: 0, cancelled: 0, queued: 0 };
}

/**
 * 纯函数：把一次状态迁移（from→to）应用到计数（钳制 ≥0）。
 * from/to 为 null 表示「无来源/无去向」（如新建只有 to=inProgress）。
 */
export function applyStatusBump(
  counts: StatusCounts,
  from: GatewayStatusBucket | null,
  to: GatewayStatusBucket | null,
): StatusCounts {
  const next = { ...counts };
  if (from && from === to) return next; // 同桶迁移：净零
  if (from) next[from] = Math.max(0, next[from] - 1);
  if (to) next[to] = Math.max(0, next[to] + 1);
  return next;
}

function bucketColumn(bucket: GatewayStatusBucket): string {
  const col = BUCKET_COLUMNS[bucket];
  if (!col) throw new Error(`unknown bucket ${bucket}`);
  return col;
}

async function bumpColumn(
  scopeKey: string,
  bucket: GatewayStatusBucket,
  delta: 1 | -1,
): Promise<void> {
  const col = `"${bucketColumn(bucket)}"`;
  // 列名来自固定白名单，安全可插值；值用参数化。INSERT 初值钳制 ≥0。
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GatewayStatsCounter" ("scopeKey","bucket",${col},"updatedAt")
     VALUES ($1, $2, GREATEST(0, $3), now())
     ON CONFLICT ("scopeKey","bucket")
     DO UPDATE SET ${col} = GREATEST(0, "GatewayStatsCounter".${col} + $3),
                   "updatedAt" = now()`,
    scopeKey,
    GATEWAY_STATS_LIVE_BUCKET,
    delta,
  );
}

/**
 * 增量更新一组 scope 的 live 计数（best-effort）。
 * 不更新 computedAt → 仍由 TTL 触发重算自愈。
 */
export async function bumpGatewayStatusCounter(
  scopeKeys: string[],
  from: GatewayStatusBucket | null,
  to: GatewayStatusBucket | null,
): Promise<void> {
  if (from === to) return;
  for (const scopeKey of scopeKeys) {
    try {
      if (from) await bumpColumn(scopeKey, from, -1);
      if (to) await bumpColumn(scopeKey, to, 1);
    } catch (e) {
      console.warn("[stats-counter] bump 失败（忽略）", { scopeKey, from, to, e });
    }
  }
}

/** 新建 RUNNING 日志：global 在飞 +1。 */
export async function bumpGatewayStatusOnCreate(
  scopeKeys: string[] = [GATEWAY_STATS_GLOBAL_SCOPE],
): Promise<void> {
  await bumpGatewayStatusCounter(scopeKeys, null, "inProgress");
}

/** 终态翻转：in-flight → succeeded/failed/cancelled。 */
export async function bumpGatewayStatusOnFinalize(
  toStatus: GatewayRequestStatus | string,
  scopeKeys: string[] = [GATEWAY_STATS_GLOBAL_SCOPE],
): Promise<void> {
  await bumpGatewayStatusCounter(scopeKeys, "inProgress", gatewayStatusToBucket(toStatus));
}

function emptyCards(): DashboardCards {
  return {
    inProgress: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    slowWarn: 0,
    backgroundWait: 0,
  };
}

type CounterRow = {
  inProgress: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  slowWarn: number;
  backgroundWait: number;
  computedAt: Date;
};

function rowToCards(row: CounterRow): DashboardCards {
  return {
    inProgress: row.inProgress,
    succeeded: row.succeeded,
    failed: row.failed,
    cancelled: row.cancelled,
    slowWarn: row.slowWarn,
    backgroundWait: row.backgroundWait,
  };
}

/** 用权威值覆盖某 scope 行（重算回填 / reconcile 纠偏）。 */
export async function reconcileGatewayStatsCounter(
  scopeKey: string,
  cards: DashboardCards,
  queued = 0,
): Promise<void> {
  const now = new Date();
  await prisma.gatewayStatsCounter.upsert({
    where: {
      scopeKey_bucket: { scopeKey, bucket: GATEWAY_STATS_LIVE_BUCKET },
    },
    create: {
      scopeKey,
      bucket: GATEWAY_STATS_LIVE_BUCKET,
      inProgress: cards.inProgress,
      succeeded: cards.succeeded,
      failed: cards.failed,
      cancelled: cards.cancelled,
      queued,
      slowWarn: cards.slowWarn,
      backgroundWait: cards.backgroundWait,
      computedAt: now,
    },
    update: {
      inProgress: cards.inProgress,
      succeeded: cards.succeeded,
      failed: cards.failed,
      cancelled: cards.cancelled,
      queued,
      slowWarn: cards.slowWarn,
      backgroundWait: cards.backgroundWait,
      computedAt: now,
    },
  });
}

const inflightRecompute = new Map<string, Promise<DashboardCards>>();

/**
 * 自愈读：投影新鲜则直接返回；过期 / 缺失 / 出错则全量重算一次并回填。
 * 同 scopeKey 的并发重算单飞合并，避免惊群。
 */
export async function getProjectedDashboardCards(opts: {
  scopeKey: string;
  recompute: () => Promise<DashboardCards>;
  ttlMs?: number;
}): Promise<DashboardCards> {
  const ttlMs = opts.ttlMs ?? GATEWAY_STATS_DEFAULT_TTL_MS;
  try {
    const row = await prisma.gatewayStatsCounter.findUnique({
      where: {
        scopeKey_bucket: {
          scopeKey: opts.scopeKey,
          bucket: GATEWAY_STATS_LIVE_BUCKET,
        },
      },
    });
    if (row && Date.now() - row.computedAt.getTime() < ttlMs) {
      return rowToCards(row);
    }
  } catch {
    // 投影读不可用：退回直接重算（不缓存）。
    return opts.recompute().catch(() => emptyCards());
  }

  const existing = inflightRecompute.get(opts.scopeKey);
  if (existing) return existing;

  const p = (async () => {
    const cards = await opts.recompute();
    await reconcileGatewayStatsCounter(opts.scopeKey, cards).catch(() => undefined);
    return cards;
  })().finally(() => inflightRecompute.delete(opts.scopeKey));
  inflightRecompute.set(opts.scopeKey, p);
  return p;
}
