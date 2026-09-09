import { randomUUID } from "crypto";

import {
  finalizeCancelledVtonBatch,
  isVtonTryonCancelledError,
  VtonTryonCancelledError,
} from "@/lib/ecom/ecom-vton/cancel";
import {
  ensureFullSetGarmentParsed,
  type VtonGarmentParseCache,
} from "@/lib/ecom/ecom-vton/garment-parsing";
import { runEcomVtonTryOn } from "@/lib/ecom/ecom-vton/tryon";
import type {
  VtonGarmentItem,
  VtonLookSpec,
  VtonTryonBatchState,
  VtonTryonProgress,
  VtonTryonResult,
  VtonTryonUrlInputs,
} from "@/lib/ecom/ecom-vton/types";
import {
  appendVtonTryonResultVersion,
  normalizeVtonTryonResultVersions,
} from "@/lib/ecom/ecom-vton/tryon-result-versions";
import {
  assertLooksResolvable,
  findGarmentInPool,
  normalizeLookForTryon,
  resolveLookTryonUrls,
} from "@/lib/ecom/ecom-vton/validate";

export type VtonBatchTryonProgress = {
  batch: VtonTryonBatchState;
  result?: VtonTryonResult;
  /** 当前套次单任务进度（仅用于步骤条 phase，勿覆盖 batch.label） */
  itemProgress?: VtonTryonProgress;
};

/** 批量试衣对外文案：始终按套次序号，不采纳单套「提交 AI 试衣任务…」等 */
export function formatVtonBatchTryonLabel(batch: VtonTryonBatchState): string {
  if (batch.status === "running") {
    if (batch.currentIndex > 0) {
      return `试衣中 ${batch.currentIndex}/${batch.total}…`;
    }
    return batch.label?.trim() || "排队中…";
  }
  if (batch.label?.trim()) return batch.label.trim();
  if (batch.status === "cancelled") return "已停止批量试衣";
  if (batch.status === "done") return "批量试衣完成";
  return "批量试衣结束";
}

/** 部分重跑：保留未选中套的已有结果，选中套重置为 pending */
export function buildVtonBatchResultsForRun(opts: {
  allLooks: VtonLookSpec[];
  targetLooks: VtonLookSpec[];
  previousResults?: VtonTryonResult[];
}): VtonTryonResult[] {
  const targetIds = new Set(opts.targetLooks.map((l) => l.id));
  const now = new Date().toISOString();
  return opts.allLooks.map((look) => {
    if (targetIds.has(look.id)) {
      const kept = opts.previousResults?.find((r) => r.lookId === look.id);
      const versions = kept ? normalizeVtonTryonResultVersions(kept) : [];
      const lastUrl = versions.length > 0 ? versions[versions.length - 1]!.ossUrl : undefined;
      return {
        id: randomUUID(),
        lookId: look.id,
        status: "pending",
        createdAt: now,
        versions: versions.length > 0 ? versions : undefined,
        activeVersionIndex: versions.length > 0 ? versions.length - 1 : undefined,
        ossUrl: lastUrl,
      };
    }
    const kept = opts.previousResults?.find((r) => r.lookId === look.id);
    if (kept) return kept;
    return {
      id: randomUUID(),
      lookId: look.id,
      status: "pending",
      createdAt: now,
    };
  });
}

function seedResultForLookRun(
  look: VtonLookSpec,
  initial?: VtonTryonResult,
): VtonTryonResult {
  const now = new Date().toISOString();
  if (!initial) {
    return {
      id: randomUUID(),
      lookId: look.id,
      status: "pending",
      createdAt: now,
    };
  }

  const versions = normalizeVtonTryonResultVersions(initial);
  const lastUrl = versions.length > 0 ? versions[versions.length - 1]!.ossUrl : initial.ossUrl;
  return {
    id: initial.id || randomUUID(),
    lookId: look.id,
    status: "pending",
    createdAt: now,
    versions: versions.length > 0 ? [...versions] : undefined,
    activeVersionIndex: versions.length > 0 ? versions.length - 1 : undefined,
    ossUrl: lastUrl,
  };
}

export function mergeVtonBatchRunIntoResults(
  merged: VtonTryonResult[],
  runResults: VtonTryonResult[],
): VtonTryonResult[] {
  const next = [...merged];
  for (const r of runResults) {
    const idx = next.findIndex((x) => x.lookId === r.lookId);
    if (idx >= 0) next[idx] = r;
    else next.push(r);
  }
  return next;
}

export function resolveVtonBatchTryonProgressPhase(
  batch: VtonTryonBatchState,
  itemProgress?: VtonTryonProgress,
): VtonTryonProgress["phase"] {
  if (batch.status === "done") return "done";
  if (batch.status === "cancelled" || batch.status === "failed") return "failed";
  if (itemProgress?.phase === "persisting") return "persisting";
  if (itemProgress?.phase === "submitting") return "submitting";
  return "polling";
}

async function resolveTryonUrlsForBatchLook(opts: {
  look: VtonLookSpec;
  garmentPool: VtonGarmentItem[];
  modelUrl: string;
  userId: string;
  projectId: string;
  consumerToolKey: string;
  garmentParseCache: VtonGarmentParseCache;
  onGarmentParsed?: (garmentId: string, parsed: { topUrl: string; bottomUrl: string }) => void;
}): Promise<VtonTryonUrlInputs> {
  const normalizedLook = normalizeLookForTryon(opts.look, opts.garmentPool);
  const urls = resolveLookTryonUrls({
    look: normalizedLook,
    garmentPool: opts.garmentPool,
    modelUrl: opts.modelUrl,
  });
  if (urls.lookKind !== "full_set") return urls;

  const set = findGarmentInPool(opts.garmentPool, normalizedLook.fullSetGarmentId);
  if (!set?.ossUrl?.trim()) {
    throw new Error(`搭配 ${normalizedLook.label ?? normalizedLook.id} 缺少套装`);
  }

  const parsed = await ensureFullSetGarmentParsed({
    userId: opts.userId,
    garment: set,
    projectId: opts.projectId,
    consumerToolKey: opts.consumerToolKey,
    cache: opts.garmentParseCache,
  });

  if (!set.parsedTopUrl?.trim() || !set.parsedBottomUrl?.trim()) {
    set.parsedTopUrl = parsed.topGarmentUrl;
    set.parsedBottomUrl = parsed.bottomGarmentUrl;
    opts.onGarmentParsed?.(set.id, {
      topUrl: parsed.topGarmentUrl,
      bottomUrl: parsed.bottomGarmentUrl,
    });
  }

  return {
    personImageUrl: urls.personImageUrl,
    topGarmentUrl: parsed.topGarmentUrl,
    bottomGarmentUrl: parsed.bottomGarmentUrl,
    lookKind: "two_piece",
  };
}

export async function runEcomVtonTryOnBatch(opts: {
  userId: string;
  consumerToolKey: string;
  projectId: string;
  modelUrl: string;
  looks: VtonLookSpec[];
  garmentPool: VtonGarmentItem[];
  /** 重跑时传入，保留已有 versions 供 appendVtonTryonResultVersion 追加 */
  initialResults?: VtonTryonResult[];
  shouldCancel?: () => boolean | Promise<boolean>;
  onProgress?: (progress: VtonBatchTryonProgress) => void | Promise<void>;
  /** 套装首次分割后回写服装池（持久化预分割 URL） */
  onGarmentParsed?: (garmentId: string, parsed: { topUrl: string; bottomUrl: string }) => void;
}): Promise<VtonTryonBatchState> {
  assertLooksResolvable(opts.looks, opts.garmentPool, opts.modelUrl);

  const batchId = randomUUID();
  const results: VtonTryonResult[] = opts.looks.map((look) => {
    const initial = opts.initialResults?.find((r) => r.lookId === look.id);
    return seedResultForLookRun(look, initial);
  });

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

  const garmentParseCache: VtonGarmentParseCache = new Map();

  for (let i = 0; i < opts.looks.length; i++) {
    if (await opts.shouldCancel?.()) {
      finalizeCancelledVtonBatch(batch);
      await opts.onProgress?.({ batch });
      return batch;
    }

    const look = opts.looks[i]!;
    const result = results[i]!;
    result.status = "running";
    batch.currentIndex = i + 1;
    batch.label = `试衣中 ${i + 1}/${opts.looks.length}…`;
    batch.updatedAt = new Date().toISOString();
    await opts.onProgress?.({ batch, result });

    try {
      const urls = await resolveTryonUrlsForBatchLook({
        look,
        garmentPool: opts.garmentPool,
        modelUrl: opts.modelUrl,
        userId: opts.userId,
        projectId: opts.projectId,
        consumerToolKey: opts.consumerToolKey,
        garmentParseCache,
        onGarmentParsed: opts.onGarmentParsed,
      });
      const ossUrl = await runEcomVtonTryOn({
        userId: opts.userId,
        consumerToolKey: opts.consumerToolKey,
        projectId: opts.projectId,
        personImageUrl: urls.personImageUrl,
        lookKind: urls.lookKind,
        topGarmentUrl: urls.topGarmentUrl,
        bottomGarmentUrl: urls.bottomGarmentUrl,
        garmentParseCache,
        shouldCancel: opts.shouldCancel,
        onProgress: async (p) => {
          batch.updatedAt = new Date().toISOString();
          await opts.onProgress?.({ batch, result, itemProgress: p });
        },
      });
      result.status = "success";
      appendVtonTryonResultVersion(result, ossUrl);
      result.failReason = undefined;
    } catch (e) {
      if (isVtonTryonCancelledError(e)) {
        result.status = "cancelled";
        result.failReason = "已停止";
        result.createdAt = new Date().toISOString();
        finalizeCancelledVtonBatch(batch);
        batch.updatedAt = new Date().toISOString();
        await opts.onProgress?.({ batch, result });
        return batch;
      }
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

export { VtonTryonCancelledError };
