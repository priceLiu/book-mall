/** 生成交通控流 · 默认参数（少配 env） */

function readPositiveInt(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey] ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
}

function readPositiveFloat(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey] ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** =1 关闭 QUEUED，恢复同步 submit（回退） */
export function isTrafficControlEnabled(): boolean {
  return process.env.TRAFFIC_CONTROL_OFF?.trim() !== "1";
}

export function getActorDispatchMinMs(): number {
  return readPositiveInt("ACTOR_DISPATCH_MIN_MS", 1200);
}

/** 车间距随机上界：下次 dispatch 间隔 ∈ [MIN, MIN+JITTER] ms，打散同批点击的 DB 洪峰。 */
export function getActorDispatchJitterMs(): number {
  return readPositiveInt("ACTOR_DISPATCH_JITTER_MS", 2000);
}

export function sampleActorDispatchSpacingMs(): number {
  const min = getActorDispatchMinMs();
  const jitter = getActorDispatchJitterMs();
  if (jitter <= 0) return min;
  return min + Math.floor(Math.random() * (jitter + 1));
}

export function getTrafficTokensPerSec(): number {
  return readPositiveFloat("TRAFFIC_TOKENS_PER_SEC", 1);
}

export function getQueueTimeoutMin(): number {
  return readPositiveInt("QUEUE_TIMEOUT_MIN", 10);
}

export function getDispatchBatch(): number {
  return readPositiveInt("DISPATCH_BATCH", 5);
}

export function getDispatchingStaleSec(): number {
  /**
   * DISPATCHING 超过此秒数未 submit 厂商 → 释放槽、退回 QUEUED 自动重派。
   * 提高到 60s：给 book-mall 冷启动 / Gateway 高峰下的「慢提交」留出完成窗口，
   * 避免提交其实成功却被判超时 → 重派 → 重复 createTask（孤儿日志 + 假性失败）。
   */
  return readPositiveInt("DISPATCHING_STALE_SEC", 60);
}

/** dispatch 内 createTask HTTP 超时（须 < DISPATCHING_STALE_SEC，默认 45s） */
export function getDispatchSubmitTimeoutMs(): number {
  const staleMs = getDispatchingStaleSec() * 1000;
  const raw = readPositiveInt("DISPATCH_SUBMIT_TIMEOUT_MS", 45_000);
  return Math.min(raw, Math.max(5_000, staleMs - 2_000));
}

/** 30s 自愈累计重派次数上限；耗尽后 fail「提交生成超时, 请重试」 */
export function getDispatchStaleRetryMax(): number {
  return readPositiveInt("DISPATCH_STALE_RETRY_MAX", 6);
}

/** RUNNING 视频 log 超过此分钟数对账释放（默认 30min；可用 env 调整） */
export function getReconcileRunningVideoMaxMin(): number {
  return readPositiveInt("RECONCILE_RUNNING_VIDEO_MAX_MIN", 30);
}

export function computeTokenBurst(maxConcurrency: number): number {
  const env = Number(process.env.TRAFFIC_TOKEN_BURST ?? "");
  if (Number.isFinite(env) && env > 0) return Math.round(env);
  // 突发额度 ≈ 并发上限的一半，保证小批量（≤一半并发）几乎同时下发、各自立刻产生 gateway 日志
  return Math.max(3, Math.ceil(maxConcurrency / 2));
}

/** Canvas / Story 进行中状态（inflight 计数） */
export const GENERATION_INFLIGHT_STATUSES = [
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
] as const;

/** 仅「提交厂商前」占新建额度；SUBMITTED 已在厂商跑不应挡再次点击生成 */
export const GENERATION_PIPELINE_INFLIGHT_STATUSES = [
  "QUEUED",
  "DISPATCHING",
  "PENDING",
] as const;

export type GenerationInflightStatus = (typeof GENERATION_INFLIGHT_STATUSES)[number];

export function isGenerationInflightStatus(
  status: string,
): status is GenerationInflightStatus {
  return (GENERATION_INFLIGHT_STATUSES as readonly string[]).includes(status);
}
