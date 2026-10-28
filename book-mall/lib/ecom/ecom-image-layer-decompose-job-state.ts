import type { ImageLayerWorkspace } from "@/lib/ecom/ecom-image-layer-project-types";

/** 后台任务心跳超过此时长，视为进程已不再处理（可重新发起） */
export const IMAGE_LAYER_DECOMPOSE_HEARTBEAT_STALE_MS = 90_000;

export type ImageLayerDecomposeJobState = {
  id: string;
  status: "running" | "succeeded" | "failed";
  sourceImageUrl?: string;
  startedAt: string;
  heartbeatAt: string;
  finishedAt?: string;
  error?: string;
};

export function parseImageLayerDecomposeJob(
  meta: unknown,
): ImageLayerDecomposeJobState | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const raw = (meta as { decomposeJob?: unknown }).decomposeJob;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const job = raw as Record<string, unknown>;
  const id = typeof job.id === "string" ? job.id.trim() : "";
  const status = job.status;
  const startedAt = typeof job.startedAt === "string" ? job.startedAt : "";
  const heartbeatAt =
    typeof job.heartbeatAt === "string" && job.heartbeatAt.trim()
      ? job.heartbeatAt
      : startedAt;
  if (!id || !startedAt) return null;
  if (status !== "running" && status !== "succeeded" && status !== "failed") {
    return null;
  }
  const sourceImageUrl =
    typeof job.sourceImageUrl === "string" ? job.sourceImageUrl : undefined;
  const finishedAt = typeof job.finishedAt === "string" ? job.finishedAt : undefined;
  const error = typeof job.error === "string" ? job.error : undefined;
  return {
    id,
    status,
    startedAt,
    heartbeatAt,
    ...(sourceImageUrl ? { sourceImageUrl } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(error ? { error } : {}),
  };
}

export function isImageLayerDecomposeJobAlive(
  job: ImageLayerDecomposeJobState,
  nowMs = Date.now(),
  staleMs = IMAGE_LAYER_DECOMPOSE_HEARTBEAT_STALE_MS,
): boolean {
  if (job.status !== "running") return false;
  const beat = Date.parse(job.heartbeatAt);
  if (!Number.isFinite(beat)) return false;
  return nowMs - beat < staleMs;
}

/**
 * 分离进行中时，客户端自动保存的 `stack: null` 不能盖掉服务端即将写入的图层。
 */
export function mergeImageLayerWorkspaceDuringDecompose(
  prev: ImageLayerWorkspace,
  incoming: ImageLayerWorkspace,
  meta: unknown,
  nowMs = Date.now(),
): ImageLayerWorkspace {
  const merged: ImageLayerWorkspace = { ...prev, ...incoming };
  const job = parseImageLayerDecomposeJob(meta);
  if (
    job &&
    isImageLayerDecomposeJobAlive(job, nowMs) &&
    incoming.stack == null &&
    prev.stack
  ) {
    merged.stack = prev.stack;
  }
  return merged;
}
