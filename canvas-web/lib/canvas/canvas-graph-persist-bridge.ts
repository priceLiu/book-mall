/** 画布保存链路 · 项目页注册的 autosave / delta persist（与图片 OSS 上传队列分离） */

import type { CanvasDeltaPatch } from "./canvas-persist-delta";

type FlushFn = (force?: boolean) => Promise<void>;
type DeltaPersistFn = (delta: CanvasDeltaPatch) => Promise<boolean>;

let flushFn: FlushFn | null = null;
let deltaPersistFn: DeltaPersistFn | null = null;

export function registerCanvasGraphPersistFlush(fn: FlushFn | null): void {
  flushFn = fn;
}

export function registerCanvasDeltaPersist(fn: DeltaPersistFn | null): void {
  deltaPersistFn = fn;
}

export async function flushCanvasGraphPersist(force = true): Promise<void> {
  await flushFn?.(force);
}

export async function persistCanvasGraphDelta(
  delta: CanvasDeltaPatch,
): Promise<boolean> {
  if (!deltaPersistFn) return false;
  return deltaPersistFn(delta);
}
