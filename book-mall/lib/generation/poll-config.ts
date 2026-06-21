/**
 * Canvas / Story 异步任务 poll worker。
 * 默认值按「≥20 人同时长视频、更多人数可继续扩」内置，日常不必配 env。
 */

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

/** 团队 Gateway/视频并发全局上限（覆盖套餐档 35 封顶；如 100、200） */
export function getTeamMaxConcurrencyCap(): number | null {
  const raw = Number(process.env.TEAM_MAX_CONCURRENCY_CAP ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
}
