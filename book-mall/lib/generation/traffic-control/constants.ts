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
  return readPositiveInt("DISPATCHING_STALE_SEC", 60);
}

/** RUNNING 视频 log 超过此分钟数对账释放（火山 45 + 余量） */
export function getReconcileRunningVideoMaxMin(): number {
  return readPositiveInt("RECONCILE_RUNNING_VIDEO_MAX_MIN", 46);
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

export type GenerationInflightStatus = (typeof GENERATION_INFLIGHT_STATUSES)[number];

export function isGenerationInflightStatus(
  status: string,
): status is GenerationInflightStatus {
  return (GENERATION_INFLIGHT_STATUSES as readonly string[]).includes(status);
}
