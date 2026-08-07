/** 画布保存链路 · 项目页注册的 autosave / delta persist（与图片 OSS 上传队列分离） */

import { sleepMs } from "@/lib/fetch-with-db-retry";
import type { CanvasDeltaPatch } from "./canvas-persist-delta";

export {
  registerCanvasProjectVersionSync,
  syncCanvasProjectVersionFromServer,
  isCanvasSaveInFlight,
  setCanvasSaveInFlight,
} from "./canvas-project-version-sync";

type FlushFn = (force?: boolean) => Promise<void>;
type DeltaPersistFn = (delta: CanvasDeltaPatch) => Promise<boolean>;
type DirtyFn = () => boolean;

let flushFn: FlushFn | null = null;
let deltaPersistFn: DeltaPersistFn | null = null;
let dirtyFn: DirtyFn | null = null;

export function registerCanvasGraphPersistFlush(fn: FlushFn | null): void {
  flushFn = fn;
}

export function registerCanvasGraphDirtyCheck(fn: DirtyFn | null): void {
  dirtyFn = fn;
}

export function isCanvasGraphDirty(): boolean {
  return dirtyFn?.() ?? false;
}

export function registerCanvasDeltaPersist(fn: DeltaPersistFn | null): void {
  deltaPersistFn = fn;
}

export async function flushCanvasGraphPersist(force = true): Promise<void> {
  await flushFn?.(force);
}

/** 生成/离开等场景：最多等待 maxWaitMs，避免 PATCH 挂死阻塞主流程 */
export async function flushCanvasGraphPersistBounded(
  maxWaitMs: number,
  force = true,
): Promise<void> {
  if (!force && !isCanvasGraphDirty()) return;
  await Promise.race([
    flushCanvasGraphPersist(force),
    sleepMs(maxWaitMs),
  ]).catch(() => undefined);
}

export async function persistCanvasGraphDelta(
  delta: CanvasDeltaPatch,
): Promise<boolean> {
  if (!deltaPersistFn) return false;
  return deltaPersistFn(delta);
}
