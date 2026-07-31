/** 画布粘贴/上传 · OSS 队列（上传链路；落盘走 canvasDelta，失败 fallback 整图 flush） */

import { buildCanvasUploadPersistDelta } from "./canvas-persist-delta";
import {
  flushCanvasGraphPersist,
  persistCanvasGraphDelta,
} from "./canvas-graph-persist-bridge";
import { buildCanvasPersistGraph } from "./canvas-persist-snapshot";
import { useCanvasStore } from "./store";

export const CANVAS_IMAGE_UPLOADS_CHANGED = "canvas:image-uploads-changed";

const pending = new Map<string, Promise<void>>();
/** OSS 成功、待 delta 落库的节点 id */
const pendingPersistNodeIds = new Set<string>();
let persistAfterDrainTimer: number | null = null;

/** OSS 全部完成后合并一次 delta 落盘，避免每张图触发整图 autosave */
const PERSIST_AFTER_UPLOAD_DRAIN_MS = 700;

function notifyUploadQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANVAS_IMAGE_UPLOADS_CHANGED));
}

async function persistUploadedNodesDelta(): Promise<void> {
  const nodeIds = [...pendingPersistNodeIds];
  pendingPersistNodeIds.clear();
  if (nodeIds.length === 0) return;

  const graph = buildCanvasPersistGraph(useCanvasStore.getState().toGraph);
  const delta = buildCanvasUploadPersistDelta(nodeIds, graph);
  if (!delta) return;

  const ok = await persistCanvasGraphDelta(delta);
  if (!ok) {
    await flushCanvasGraphPersist(true);
  }
}

function schedulePersistAfterUploadDrain(): void {
  if (pending.size > 0) return;
  if (persistAfterDrainTimer !== null) {
    window.clearTimeout(persistAfterDrainTimer);
  }
  persistAfterDrainTimer = window.setTimeout(() => {
    persistAfterDrainTimer = null;
    if (pending.size > 0) return;
    void persistUploadedNodesDelta();
  }, PERSIST_AFTER_UPLOAD_DRAIN_MS);
}

export function trackCanvasImageUpload(
  nodeId: string,
  promise: Promise<void>,
): void {
  pending.set(nodeId, promise);
  notifyUploadQueueChanged();
  void promise
    .then(() => {
      pendingPersistNodeIds.add(nodeId);
    })
    .finally(() => {
      if (pending.get(nodeId) === promise) {
        pending.delete(nodeId);
        notifyUploadQueueChanged();
        schedulePersistAfterUploadDrain();
      }
    });
}

export function hasPendingCanvasImageUploads(): boolean {
  return pending.size > 0;
}

export function pendingCanvasImageUploadCount(): number {
  return pending.size;
}

/** 导航离开画布前等待 OSS 落库（超时后仍放行，避免永久卡住） */
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

/** 离开画布前：若已有 OSS 结果但 delta 尚未发出，立即落盘 */
export async function flushPendingCanvasImageUploadPersist(): Promise<void> {
  if (persistAfterDrainTimer !== null) {
    window.clearTimeout(persistAfterDrainTimer);
    persistAfterDrainTimer = null;
  }
  if (pending.size > 0) return;
  await persistUploadedNodesDelta();
}
