/** 画布粘贴/上传 · OSS 队列（落盘走增量 flush，避免整图 PATCH 与服务端媒体写回冲突） */

import { flushCanvasGraphPersist } from "./canvas-graph-persist-bridge";
import { useCanvasStore } from "./store";

export const CANVAS_IMAGE_UPLOADS_CHANGED = "canvas:image-uploads-changed";

const pending = new Map<string, Promise<void>>();
const uploadGeneration = new Map<string, number>();
const staleTimers = new Map<string, number>();
let persistAfterDrainTimer: number | null = null;
let structurePersistTimer: number | null = null;
let persistInFlight: Promise<boolean> | null = null;

const PERSIST_AFTER_UPLOAD_DRAIN_MS = 700;
export const CANVAS_IMAGE_UPLOAD_STALE_MS = 90_000;

function notifyUploadQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANVAS_IMAGE_UPLOADS_CHANGED));
}

function clearStaleTimer(nodeId: string): void {
  const t = staleTimers.get(nodeId);
  if (t !== undefined) {
    window.clearTimeout(t);
    staleTimers.delete(nodeId);
  }
}

/** OSS 完成后增量落盘（遇 409 由 autosave 轻量对齐版本） */
async function persistAfterUploadDrain(): Promise<boolean> {
  await flushCanvasGraphPersist(false);
  return true;
}

function runPersistAfterUploadDrain(): Promise<boolean> {
  if (!persistInFlight) {
    persistInFlight = persistAfterUploadDrain().finally(() => {
      persistInFlight = null;
    });
  }
  return persistInFlight;
}

function schedulePersistAfterUploadDrain(): void {
  if (pending.size > 0) return;
  if (persistAfterDrainTimer !== null) {
    window.clearTimeout(persistAfterDrainTimer);
  }
  const delay = pending.size > 1 ? PERSIST_AFTER_UPLOAD_DRAIN_MS : 0;
  if (delay === 0) {
    void runPersistAfterUploadDrain();
    return;
  }
  persistAfterDrainTimer = window.setTimeout(() => {
    persistAfterDrainTimer = null;
    if (pending.size > 0) return;
    void runPersistAfterUploadDrain();
  }, delay);
}

export function trackCanvasImageUpload(
  nodeId: string,
  promise: Promise<void>,
  onStale?: () => void,
): void {
  const gen = (uploadGeneration.get(nodeId) ?? 0) + 1;
  uploadGeneration.set(nodeId, gen);
  clearStaleTimer(nodeId);

  pending.set(nodeId, promise);
  notifyUploadQueueChanged();

  staleTimers.set(
    nodeId,
    window.setTimeout(() => {
      if (uploadGeneration.get(nodeId) !== gen) return;
      if (pending.get(nodeId) !== promise) return;
      pending.delete(nodeId);
      clearStaleTimer(nodeId);
      notifyUploadQueueChanged();
      onStale?.();
    }, CANVAS_IMAGE_UPLOAD_STALE_MS),
  );

  void promise.finally(() => {
    if (uploadGeneration.get(nodeId) !== gen) return;
    clearStaleTimer(nodeId);
    if (pending.get(nodeId) === promise) {
      pending.delete(nodeId);
      notifyUploadQueueChanged();
      schedulePersistAfterUploadDrain();
    }
  });
}

/** 粘贴/上传后 debounce 落盘节点骨架（增量 PATCH，非 force 整图） */
export function scheduleCanvasStructurePersistAfterPaste(): void {
  if (structurePersistTimer !== null) {
    window.clearTimeout(structurePersistTimer);
  }
  structurePersistTimer = window.setTimeout(() => {
    structurePersistTimer = null;
    void flushCanvasGraphPersist(false);
  }, 600);
}

/** 打开画布后：清掉无队列任务的 uploading 标记 */
export function reconcileStaleCanvasImageUploadFlags(
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const { nodes } = useCanvasStore.getState();
  for (const node of nodes) {
    const d = node.data as { uploading?: boolean };
    if (d.uploading && !pending.has(node.id)) {
      updateNodeData(node.id, {
        uploading: false,
        uploadError: "上次上传未完成，请重新粘贴",
      });
    }
  }
  if (pending.size === 0) {
    notifyUploadQueueChanged();
  }
}

export function hasPendingCanvasImageUploads(): boolean {
  return pending.size > 0;
}

export function isCanvasImageUploadPending(nodeId: string): boolean {
  return pending.has(nodeId);
}

export function pendingCanvasImageUploadCount(): number {
  return pending.size;
}

export async function waitForPendingCanvasImageUploads(
  timeoutMs = 60_000,
): Promise<void> {
  if (pending.size === 0) return;
  const jobs = [...pending.values()];
  await Promise.race([
    Promise.all(jobs),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

export async function flushPendingCanvasImageUploadPersist(): Promise<void> {
  if (persistAfterDrainTimer !== null) {
    window.clearTimeout(persistAfterDrainTimer);
    persistAfterDrainTimer = null;
  }
  await waitForPendingCanvasImageUploads(60_000);
  await runPersistAfterUploadDrain();
}
