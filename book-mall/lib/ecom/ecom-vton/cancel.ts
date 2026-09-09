import { mergeVtonMeta, sanitizeVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";
import type { VtonProjectMeta, VtonTryonBatchState } from "@/lib/ecom/ecom-vton/types";

export class VtonTryonCancelledError extends Error {
  constructor(message = "已停止批量试衣") {
    super(message);
    this.name = "VtonTryonCancelledError";
  }
}

export function isVtonTryonCancelledError(e: unknown): e is VtonTryonCancelledError {
  return e instanceof VtonTryonCancelledError;
}

export function isVtonBatchCancelRequested(metaRaw: unknown, batchId: string): boolean {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  return meta.tryonBatchCancelBatchId === batchId;
}

export function requestVtonBatchTryonCancel(metaRaw: unknown, batchId: string): VtonProjectMeta {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  const batch = meta.tryonBatch;
  if (!batch || batch.batchId !== batchId || batch.status !== "running") {
    throw new Error("当前没有进行中的批量试衣");
  }
  return mergeVtonMeta(meta, { tryonBatchCancelBatchId: batchId });
}

export function finalizeCancelledVtonBatch(batch: VtonTryonBatchState): VtonTryonBatchState {
  for (const r of batch.results) {
    if (r.status === "pending" || r.status === "running") {
      r.status = "cancelled";
      r.failReason = "已停止";
      r.createdAt = new Date().toISOString();
    }
  }
  const successCount = batch.results.filter((r) => r.status === "success").length;
  batch.status = "cancelled";
  batch.label =
    successCount > 0
      ? `已停止（已完成 ${successCount}/${batch.total}）`
      : "已停止批量试衣";
  batch.updatedAt = new Date().toISOString();
  return batch;
}

/** 轮询间隔内可响应取消 */
export async function vtonInterruptibleDelay(
  ms: number,
  shouldCancel?: () => boolean | Promise<boolean>,
): Promise<void> {
  const step = 250;
  let elapsed = 0;
  while (elapsed < ms) {
    if (await shouldCancel?.()) throw new VtonTryonCancelledError();
    const wait = Math.min(step, ms - elapsed);
    await new Promise((r) => setTimeout(r, wait));
    elapsed += wait;
  }
}
