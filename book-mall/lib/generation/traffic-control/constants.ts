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
  return readPositiveInt("ACTOR_DISPATCH_MIN_MS", 2500);
}

export function getTrafficTokensPerSec(): number {
  return readPositiveFloat("TRAFFIC_TOKENS_PER_SEC", 0.5);
}

export function getQueueTimeoutMin(): number {
  return readPositiveInt("QUEUE_TIMEOUT_MIN", 10);
}

export function getDispatchBatch(): number {
  return readPositiveInt("DISPATCH_BATCH", 10);
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
  return Math.max(2, Math.ceil(maxConcurrency / 4));
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
