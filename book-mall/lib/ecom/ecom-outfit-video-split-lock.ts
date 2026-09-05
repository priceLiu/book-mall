/** 进程内拆镜互斥：防止同一 project 并发 POST split-scene 重复跑 FFmpeg + LLM enrich */
const activeProjectIds = new Set<string>();

const SPLIT_LOCK_STALE_MS = 15 * 60_000;

export function tryAcquireOutfitSplitLock(projectId: string): boolean {
  if (activeProjectIds.has(projectId)) return false;
  activeProjectIds.add(projectId);
  return true;
}

export function releaseOutfitSplitLock(projectId: string): void {
  activeProjectIds.delete(projectId);
}

export function isOutfitSplitInProgress(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const at = (meta as Record<string, unknown>).splitInProgressAt;
  if (typeof at !== "number" || !Number.isFinite(at)) return false;
  return Date.now() - at < SPLIT_LOCK_STALE_MS;
}

export function outfitSplitLockStaleMs(): number {
  return SPLIT_LOCK_STALE_MS;
}

/** 无分镜且 meta 锁已过期时，清除卡住的 splitting / splitProgress */
export function reconcileStaleOutfitSplitState(input: {
  status?: string;
  sceneList?: unknown[];
  meta?: unknown;
}): {
  dirty: boolean;
  status?: string;
  meta?: Record<string, unknown>;
} {
  if ((input.sceneList?.length ?? 0) > 0) return { dirty: false };
  if (isOutfitSplitInProgress(input.meta)) return { dirty: false };

  const staleStatus = input.status === "splitting";
  const baseMeta =
    input.meta && typeof input.meta === "object"
      ? { ...(input.meta as Record<string, unknown>) }
      : {};
  const hadSplitFields =
    staleStatus ||
    baseMeta.splitInProgressAt != null ||
    baseMeta.splitProgress != null ||
    baseMeta.splitLlmStreamTail != null;
  if (!hadSplitFields) return { dirty: false };

  baseMeta.splitInProgressAt = null;
  delete baseMeta.splitProgress;
  delete baseMeta.splitLlmStreamTail;
  return {
    dirty: true,
    meta: baseMeta,
    status: staleStatus ? "draft" : undefined,
  };
}
