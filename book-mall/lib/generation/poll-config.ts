/**
 * Canvas / Story 异步任务 poll worker。
 * 默认值按「≥20 人同时长视频、更多人数可继续扩」内置，日常不必配 env。
 * 实际并行路数由 getEffectiveGenerationPollConcurrency() 按本进程 connection_limit 封顶。
 */

import { getPrismaConnectionLimit } from "@/lib/prisma-pool-config";

function readPositiveInt(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey] ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
}

/** 每轮 DB 取出的 SUBMITTED 上限（默认 100，约覆盖 20～100 人各 1 条长视频） */
export function getGenerationPollBatch(): number {
  const raw = Number(
    process.env.GENERATION_POLL_BATCH ?? process.env.CANVAS_POLL_BATCH ?? "",
  );
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 100;
}

/** 同一 tick 内并行 poll 厂商/Gateway 的路数（默认 25） */
export function getGenerationPollConcurrency(): number {
  return readPositiveInt("GENERATION_POLL_CONCURRENCY", 25);
}

/**
 * 独立 poll-loop / cron 进程（可跑满并行度）。
 * poll-loop 脚本应设 GENERATION_POLL_WORKER=1 或 PRISMA_CONNECTION_LIMIT=1。
 */
export function isGenerationPollWorkerProcess(): boolean {
  const flag = process.env.GENERATION_POLL_WORKER?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  return process.env.PRISMA_CONNECTION_LIMIT?.trim() === "1";
}

/** Web/API 进程内 opportunistic poll 最多并行路数（避免占满 connection_limit=30） */
const WEB_OPPORTUNISTIC_POLL_CONCURRENCY = 2;

/**
 * 按本进程 Prisma 连接池上限封顶 poll 并行度。
 * poll-loop 子进程 PRISMA_CONNECTION_LIMIT=1 时自动降为 1，避免 25 路抢 1 连接 → pool timeout。
 * web 进程保留 WEB_DB_RESERVE 条连接给 run / tasks 读 / SSE 等 API。
 */
const WEB_DB_RESERVE = 3;

export function getEffectiveGenerationPollConcurrency(): number {
  const configured = getGenerationPollConcurrency();
  if (!isGenerationPollWorkerProcess()) {
    return Math.min(configured, WEB_OPPORTUNISTIC_POLL_CONCURRENCY);
  }
  const poolLimit = getPrismaConnectionLimit();
  const cap = Math.max(1, poolLimit - WEB_DB_RESERVE);
  return Math.min(configured, cap);
}

/** 单次 worker 最多连续扫描轮数（默认 10） */
export function getGenerationPollMaxPasses(): number {
  return readPositiveInt("GENERATION_POLL_MAX_PASSES", 10);
}

/** 单次 HTTP/cron 调用时间预算 ms（默认 50s，留余量给 60s 上限） */
export function getGenerationPollTimeBudgetMs(): number {
  return readPositiveInt("GENERATION_POLL_TIME_BUDGET_MS", 50_000);
}

/** 单次 recordInfo / createTask 内层超时（默认 45s；dev 下 recordInfo 常 >8s） */
export function getGenerationPollInnerTimeoutMs(): number {
  return readPositiveInt("GENERATION_POLL_INNER_TIMEOUT_MS", 45_000);
}

/** 单条 recordInfo 之间的节流 ms（高负载时可设 200–500 降低 DB/Gateway 读频率） */
export function getGenerationPollRecordPauseMs(): number {
  return readPositiveInt("GENERATION_POLL_RECORD_PAUSE_MS", 0);
}

/** 分片总数（多实例/多 SCF 时设为 4/8…，默认 1 = 不分片） */
export function getGenerationPollShardCount(): number {
  return readPositiveInt("GENERATION_POLL_SHARD_COUNT", 1);
}

/** 本分片序号 0 … count-1（每实例不同） */
export function getGenerationPollShardIndex(): number {
  const count = getGenerationPollShardCount();
  const raw = Number(process.env.GENERATION_POLL_SHARD_INDEX ?? "");
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(Math.round(raw), Math.max(0, count - 1));
}

/** Next.js route maxDuration 须在 route 文件写编译期字面量（默认 300） */
export function getGenerationPollMaxDurationSec(): number {
  return readPositiveInt("GENERATION_POLL_MAX_DURATION_SEC", 300);
}

/** 生成耗时预警阈值 ms（默认 800s；列表「预警」Tab + poll 升格） */
export function getGenerationSlowWarnMs(): number {
  return readPositiveInt("GENERATION_SLOW_WARN_MS", 800_000);
}

/** 团队 Gateway/视频并发全局上限（覆盖套餐档 35 封顶；如 100、200） */
export function getTeamMaxConcurrencyCap(): number | null {
  const raw = Number(process.env.TEAM_MAX_CONCURRENCY_CAP ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
}
