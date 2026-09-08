import { randomUUID } from "crypto";

import { runEcomVtonTryOn } from "@/lib/ecom/ecom-vton/tryon";
import type {
  VtonGarmentItem,
  VtonLookSpec,
  VtonTryonBatchState,
  VtonTryonResult,
} from "@/lib/ecom/ecom-vton/types";
import {
  assertLooksResolvable,
  resolveLookTryonUrls,
} from "@/lib/ecom/ecom-vton/validate";

export type VtonBatchTryonProgress = {
  batch: VtonTryonBatchState;
  result?: VtonTryonResult;
};

export async function runEcomVtonTryOnBatch(opts: {
  userId: string;
  consumerToolKey: string;
  projectId: string;
  modelUrl: string;
  looks: VtonLookSpec[];
  garmentPool: VtonGarmentItem[];
  onProgress?: (progress: VtonBatchTryonProgress) => void | Promise<void>;
}): Promise<VtonTryonBatchState> {
  assertLooksResolvable(opts.looks, opts.garmentPool, opts.modelUrl);

  const batchId = randomUUID();
  const results: VtonTryonResult[] = opts.looks.map((look) => ({
    id: randomUUID(),
    lookId: look.id,
    status: "pending",
    createdAt: new Date().toISOString(),
  }));

  const batch: VtonTryonBatchState = {
    batchId,
    status: "running",
    currentIndex: 0,
    total: opts.looks.length,
    label: "准备批量试衣…",
    results,
    updatedAt: new Date().toISOString(),
  };

  await opts.onProgress?.({ batch });

  for (let i = 0; i < opts.looks.length; i++) {
    const look = opts.looks[i]!;
    const result = results[i]!;
    result.status = "running";
    batch.currentIndex = i + 1;
    batch.label = `试衣中 ${i + 1}/${opts.looks.length}…`;
    batch.updatedAt = new Date().toISOString();
    await opts.onProgress?.({ batch, result });

    try {
      const urls = resolveLookTryonUrls({
        look,
        garmentPool: opts.garmentPool,
        modelUrl: opts.modelUrl,
      });
      const ossUrl = await runEcomVtonTryOn({
        userId: opts.userId,
        consumerToolKey: opts.consumerToolKey,
        projectId: opts.projectId,
        personImageUrl: urls.personImageUrl,
        lookKind: urls.lookKind,
        topGarmentUrl: urls.topGarmentUrl,
        bottomGarmentUrl: urls.bottomGarmentUrl,
        onProgress: async (p) => {
          batch.label = p.label || batch.label;
          batch.updatedAt = new Date().toISOString();
          await opts.onProgress?.({ batch, result });
        },
      });
      result.status = "success";
      result.ossUrl = ossUrl;
      result.failReason = undefined;
    } catch (e) {
      result.status = "failed";
      result.failReason = e instanceof Error ? e.message : "试衣失败";
    }
    result.createdAt = new Date().toISOString();
    batch.updatedAt = new Date().toISOString();
    await opts.onProgress?.({ batch, result });
  }

  batch.status = batch.results.every((r) => r.status === "failed") ? "failed" : "done";
  batch.label =
    batch.status === "done"
      ? `批量试衣完成（${batch.results.filter((r) => r.status === "success").length}/${batch.total}）`
      : "批量试衣结束（存在失败）";
  batch.updatedAt = new Date().toISOString();
  await opts.onProgress?.({ batch });

  return batch;
}
