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
import {
  prepareVtonGarmentUrlForTryon,
  type VtonGarmentPrepareCache,
} from "@/lib/ecom/ecom-vton/garment-tryon-prepare";
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

/** 批量试衣默认并行度（aitryon-plus 异步任务，可安全并行） */
export const VTON_BATCH_TRYON_CONCURRENCY = 4;

export function countVtonBatchFinishedResults(results: VtonTryonResult[]): number {
  return results.filter(
    (r) => r.status === "success" || r.status === "failed" || r.status === "cancelled",
  ).length;
}

export function formatVtonBatchRunningProgressLabel(
  batch: Pick<VtonTryonBatchState, "total" | "results">,
): string {
  const done = countVtonBatchFinishedResults(batch.results);
  const running = batch.results.filter((r) => r.status === "running").length;
  if (done === 0 && running === 0) return "排队中…";
  if (running > 1) return `试衣中 ${done}/${batch.total}（${running} 套并行）…`;
  return `试衣中 ${done}/${batch.total}…`;
}

function refreshVtonBatchRunningProgress(batch: VtonTryonBatchState): void {
  batch.currentIndex = countVtonBatchFinishedResults(batch.results);
  batch.label = formatVtonBatchRunningProgressLabel(batch);
}

/** 批量试衣对外文案：始终按套次序号，不采纳单套「提交 AI 试衣任务…」等 */
export function formatVtonBatchTryonLabel(batch: VtonTryonBatchState): string {
  if (batch.status === "running") {
    const custom = batch.label?.trim();
    if (
      custom &&
      custom !== "准备批量试衣…" &&
      custom !== "排队中…" &&
      /^试衣中 \d+\/\d+/.test(custom)
    ) {
      return custom;
    }
    if (batch.currentIndex > 0) {
      return `试衣中 ${batch.currentIndex}/${batch.total}…`;
    }
    return custom || "排队中…";
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

type FullSetGarmentUrls = { topGarmentUrl: string; bottomGarmentUrl: string };

function applyParsedFullSetToPool(opts: {
  set: VtonGarmentItem;
  parsed: FullSetGarmentUrls;
  onGarmentParsed?: (garmentId: string, parsed: { topUrl: string; bottomUrl: string }) => void;
}): void {
  const prevTop = opts.set.parsedTopUrl?.trim();
  const prevBottom = opts.set.parsedBottomUrl?.trim();
  if (
    opts.parsed.topGarmentUrl !== prevTop ||
    opts.parsed.bottomGarmentUrl !== prevBottom
  ) {
    opts.set.parsedTopUrl = opts.parsed.topGarmentUrl;
    opts.set.parsedBottomUrl = opts.parsed.bottomGarmentUrl;
    opts.onGarmentParsed?.(opts.set.id, {
      topUrl: opts.parsed.topGarmentUrl,
      bottomUrl: opts.parsed.bottomGarmentUrl,
    });
  }
}

/** 批量试衣前统一分割/收紧套装，避免并行 worker 各自解析导致上下装 URL 不一致 */
async function prefetchFullSetGarmentUrlsForBatch(opts: {
  looks: VtonLookSpec[];
  garmentPool: VtonGarmentItem[];
  userId: string;
  projectId: string;
  consumerToolKey: string;
  garmentParseCache: VtonGarmentParseCache;
  onGarmentParsed?: (garmentId: string, parsed: { topUrl: string; bottomUrl: string }) => void;
}): Promise<Map<string, FullSetGarmentUrls>> {
  const bySetId = new Map<string, FullSetGarmentUrls>();
  for (const look of opts.looks) {
    const normalizedLook = normalizeLookForTryon(look, opts.garmentPool);
    const setId = normalizedLook.fullSetGarmentId?.trim();
    if (!setId || bySetId.has(setId)) continue;

    const set = findGarmentInPool(opts.garmentPool, setId);
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
    applyParsedFullSetToPool({ set, parsed, onGarmentParsed: opts.onGarmentParsed });
    bySetId.set(setId, parsed);
  }
  return bySetId;
}

async function resolveTryonUrlsForBatchLook(opts: {
  look: VtonLookSpec;
  garmentPool: VtonGarmentItem[];
  modelUrl: string;
  userId: string;
  garmentPrepareCache: VtonGarmentPrepareCache;
  prefetchedFullSets: Map<string, FullSetGarmentUrls>;
}): Promise<VtonTryonUrlInputs> {
  const normalizedLook = normalizeLookForTryon(opts.look, opts.garmentPool);
  const personImageUrl = opts.modelUrl.trim();
  if (!personImageUrl) throw new Error("缺少模特全身照");

  const setId = normalizedLook.fullSetGarmentId?.trim();
  if (setId) {
    const parsed = opts.prefetchedFullSets.get(setId);
    if (!parsed) {
      throw new Error(`搭配 ${normalizedLook.label ?? normalizedLook.id} 缺少套装上下装`);
    }
    const [topGarmentUrl, bottomGarmentUrl] = await Promise.all([
      prepareVtonGarmentUrlForTryon({
        userId: opts.userId,
        garmentUrl: parsed.topGarmentUrl,
        cache: opts.garmentPrepareCache,
      }),
      prepareVtonGarmentUrlForTryon({
        userId: opts.userId,
        garmentUrl: parsed.bottomGarmentUrl,
        cache: opts.garmentPrepareCache,
      }),
    ]);
    return {
      personImageUrl,
      topGarmentUrl,
      bottomGarmentUrl,
      lookKind: "two_piece",
    };
  }

  const urls = resolveLookTryonUrls({
    look: normalizedLook,
    garmentPool: opts.garmentPool,
    modelUrl: personImageUrl,
  });
  const [topGarmentUrl, bottomGarmentUrl] = await Promise.all([
    urls.topGarmentUrl
      ? prepareVtonGarmentUrlForTryon({
          userId: opts.userId,
          garmentUrl: urls.topGarmentUrl,
          cache: opts.garmentPrepareCache,
        })
      : Promise.resolve(undefined),
    urls.bottomGarmentUrl
      ? prepareVtonGarmentUrlForTryon({
          userId: opts.userId,
          garmentUrl: urls.bottomGarmentUrl,
          cache: opts.garmentPrepareCache,
        })
      : Promise.resolve(undefined),
  ]);
  return {
    personImageUrl: urls.personImageUrl,
    topGarmentUrl,
    bottomGarmentUrl,
    lookKind: urls.lookKind,
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

  let progressChain: Promise<void> = Promise.resolve();
  const emitProgress = (progress: VtonBatchTryonProgress) => {
    progressChain = progressChain.then(async () => {
      await opts.onProgress?.(progress);
    });
    return progressChain;
  };

  await emitProgress({ batch });

  const garmentParseCache: VtonGarmentParseCache = new Map();
  const garmentPrepareCache: VtonGarmentPrepareCache = new Map();
  const prefetchedFullSets = await prefetchFullSetGarmentUrlsForBatch({
    looks: opts.looks,
    garmentPool: opts.garmentPool,
    userId: opts.userId,
    projectId: opts.projectId,
    consumerToolKey: opts.consumerToolKey,
    garmentParseCache,
    onGarmentParsed: opts.onGarmentParsed,
  });
  let stopStarting = false;

  const shouldAbort = async (): Promise<boolean> => {
    if (stopStarting) return true;
    if (await opts.shouldCancel?.()) {
      stopStarting = true;
      return true;
    }
    return false;
  };

  async function processLookIndex(i: number): Promise<boolean> {
    if (await shouldAbort()) return false;

    const look = opts.looks[i]!;
    const result = results[i]!;
    result.status = "running";
    batch.updatedAt = new Date().toISOString();
    refreshVtonBatchRunningProgress(batch);
    await emitProgress({ batch, result });

    try {
      const urls = await resolveTryonUrlsForBatchLook({
        look,
        garmentPool: opts.garmentPool,
        modelUrl: opts.modelUrl,
        userId: opts.userId,
        garmentPrepareCache,
        prefetchedFullSets,
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
        garmentUrlsPrepared: true,
        shouldCancel: shouldAbort,
        onProgress: async (p) => {
          batch.updatedAt = new Date().toISOString();
          await emitProgress({ batch, result, itemProgress: p });
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
        stopStarting = true;
        return false;
      }
      result.status = "failed";
      result.failReason = e instanceof Error ? e.message : "试衣失败";
    }

    result.createdAt = new Date().toISOString();
    batch.updatedAt = new Date().toISOString();
    refreshVtonBatchRunningProgress(batch);
    await emitProgress({ batch, result });
    return true;
  }

  let nextIndex = 0;
  const workerCount = Math.min(VTON_BATCH_TRYON_CONCURRENCY, opts.looks.length);

  async function worker(): Promise<void> {
    while (!stopStarting) {
      if (await shouldAbort()) return;
      const i = nextIndex;
      nextIndex += 1;
      if (i >= opts.looks.length) return;
      const ok = await processLookIndex(i);
      if (!ok) return;
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  await progressChain;

  if (stopStarting || (await opts.shouldCancel?.())) {
    finalizeCancelledVtonBatch(batch);
    batch.updatedAt = new Date().toISOString();
    await emitProgress({ batch });
    return batch;
  }

  batch.status = batch.results.every((r) => r.status === "failed") ? "failed" : "done";
  batch.label =
    batch.status === "done"
      ? `批量试衣完成（${batch.results.filter((r) => r.status === "success").length}/${batch.total}）`
      : "批量试衣结束（存在失败）";
  batch.updatedAt = new Date().toISOString();
  await emitProgress({ batch });

  return batch;
}

export { VtonTryonCancelledError };
