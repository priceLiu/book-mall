import { randomUUID } from "crypto";

import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import {
  finalizeModelGenerationsMeta,
  sanitizeModelGenerations,
} from "@/lib/ecom/ecom-vton/model-generations";
import type {
  VtonGarmentItem,
  VtonLockedLook,
  VtonLookSpec,
  VtonProjectMeta,
  VtonTryonBatchState,
  VtonTryonHistoryEntry,
  VtonTryonProgress,
  VtonTextTryonRef,
  VtonTextTryonResult,
  VtonTryonResult,
} from "@/lib/ecom/ecom-vton/types";
import { ECOM_VTON_MAX_BATCH_LOOKS } from "@/lib/ecom/ecom-vton/types";

const GARMENT_KINDS = new Set(["top", "bottom", "one_piece", "full_set"]);
const LOOK_KINDS = new Set(["two_piece", "one_piece", "top_only", "bottom_only", "full_set"]);
export function emptyVtonProjectMeta(): VtonProjectMeta {
  return {
    garmentPool: [],
    lookDrafts: [],
    lockedLooks: [],
    tryonBatch: null,
    tryonProgress: null,
  };
}

function sanitizeGarmentItem(raw: unknown): VtonGarmentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const kind = o.kind;
  const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
  if (!id || !ossUrl || typeof kind !== "string" || !GARMENT_KINDS.has(kind)) return null;
  const parsedTopUrl =
    typeof o.parsedTopUrl === "string" && o.parsedTopUrl.trim()
      ? o.parsedTopUrl.trim()
      : undefined;
  const parsedBottomUrl =
    typeof o.parsedBottomUrl === "string" && o.parsedBottomUrl.trim()
      ? o.parsedBottomUrl.trim()
      : undefined;
  const fullSetInputMode =
    o.fullSetInputMode === "composite" || o.fullSetInputMode === "manual"
      ? o.fullSetInputMode
      : undefined;
  return {
    id,
    kind: kind as VtonGarmentItem["kind"],
    ossUrl,
    label: typeof o.label === "string" ? o.label : undefined,
    source:
      typeof o.source === "string"
        ? (o.source as VtonGarmentItem["source"])
        : undefined,
    ...(fullSetInputMode ? { fullSetInputMode } : {}),
    ...(parsedTopUrl ? { parsedTopUrl } : {}),
    ...(parsedBottomUrl ? { parsedBottomUrl } : {}),
  };
}

function sanitizeTextTryonRef(raw: unknown): VtonTextTryonRef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  if (!id || !ossUrl || !createdAt) return null;
  return {
    id,
    ossUrl,
    label: typeof o.label === "string" ? o.label : undefined,
    createdAt,
  };
}

const TEXT_TRYON_RATIOS = new Set(["1:1", "3:4", "4:5", "16:9"]);

export function parseVtonTextTryonResult(raw: unknown): VtonTextTryonResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
  const prompt = typeof o.prompt === "string" ? o.prompt : "";
  const modelKey = typeof o.modelKey === "string" ? o.modelKey.trim() : "";
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  if (!id || !ossUrl || !modelKey || !createdAt) return null;
  const ratioRaw = typeof o.ratio === "string" ? o.ratio.trim() : "";
  const ratio = TEXT_TRYON_RATIOS.has(ratioRaw)
    ? (ratioRaw as VtonTextTryonResult["ratio"])
    : undefined;
  const width = typeof o.width === "number" && o.width > 0 ? Math.round(o.width) : undefined;
  const height = typeof o.height === "number" && o.height > 0 ? Math.round(o.height) : undefined;
  return {
    id,
    ossUrl,
    prompt,
    modelKey,
    createdAt,
    ...(ratio ? { ratio } : {}),
    ...(width && height ? { width, height } : {}),
  };
}

function sanitizeLookSpec(raw: unknown): VtonLookSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const kind = o.kind;
  if (!id || typeof kind !== "string" || !LOOK_KINDS.has(kind)) return null;
  return {
    id,
    kind: kind as VtonLookSpec["kind"],
    label: typeof o.label === "string" ? o.label : undefined,
    topGarmentId: typeof o.topGarmentId === "string" ? o.topGarmentId : undefined,
    bottomGarmentId: typeof o.bottomGarmentId === "string" ? o.bottomGarmentId : undefined,
    onePieceGarmentId:
      typeof o.onePieceGarmentId === "string" ? o.onePieceGarmentId : undefined,
    fullSetGarmentId:
      typeof o.fullSetGarmentId === "string" ? o.fullSetGarmentId : undefined,
  };
}

function sanitizeTryonResult(raw: unknown): VtonTryonResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const lookId = typeof o.lookId === "string" ? o.lookId.trim() : "";
  const status = o.status;
  if (
    !id ||
    !lookId ||
    (status !== "pending" &&
      status !== "running" &&
      status !== "success" &&
      status !== "failed" &&
      status !== "cancelled")
  ) {
    return null;
  }
  const versions: VtonTryonResult["versions"] = [];
  if (Array.isArray(o.versions)) {
    for (const row of o.versions) {
      if (!row || typeof row !== "object") continue;
      const v = row as Record<string, unknown>;
      const ossUrl = typeof v.ossUrl === "string" ? v.ossUrl.trim() : "";
      if (!ossUrl) continue;
      versions.push({
        ossUrl,
        createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
        resultId: typeof v.resultId === "string" ? v.resultId : id,
      });
    }
  }
  return {
    id,
    lookId,
    status,
    ossUrl: typeof o.ossUrl === "string" ? o.ossUrl : undefined,
    failReason: typeof o.failReason === "string" ? o.failReason : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    versions: versions.length > 0 ? versions : undefined,
    activeVersionIndex:
      typeof o.activeVersionIndex === "number" ? o.activeVersionIndex : undefined,
  };
}

function sanitizeTryonBatch(raw: unknown): VtonTryonBatchState | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const batchId = typeof o.batchId === "string" ? o.batchId : "";
  const status = o.status;
  if (
    !batchId ||
    (status !== "running" && status !== "done" && status !== "failed" && status !== "cancelled")
  ) {
    return undefined;
  }
  const results: VtonTryonResult[] = [];
  if (Array.isArray(o.results)) {
    for (const row of o.results) {
      const parsed = sanitizeTryonResult(row);
      if (parsed) results.push(parsed);
    }
  }
  return {
    batchId,
    status,
    currentIndex: typeof o.currentIndex === "number" ? o.currentIndex : 0,
    total: typeof o.total === "number" ? o.total : results.length,
    label: typeof o.label === "string" ? o.label : undefined,
    results,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

function sanitizeLockedLook(raw: unknown): VtonLockedLook | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
  const source = o.source;
  if (
    !id ||
    !ossUrl ||
    (source !== "aitryon-plus" && source !== "upload" && source !== "import")
  ) {
    return null;
  }
  return {
    id,
    ossUrl,
    label: typeof o.label === "string" ? o.label : undefined,
    source,
    resultId: typeof o.resultId === "string" ? o.resultId : undefined,
    lockedAt: typeof o.lockedAt === "string" ? o.lockedAt : new Date().toISOString(),
  };
}

export function sanitizeVtonProjectMeta(raw: unknown): VtonProjectMeta {
  if (!raw || typeof raw !== "object") return emptyVtonProjectMeta();
  const o = raw as Record<string, unknown>;

  const garmentPool: VtonGarmentItem[] = [];
  if (Array.isArray(o.garmentPool)) {
    for (const row of o.garmentPool) {
      const parsed = sanitizeGarmentItem(row);
      if (parsed) garmentPool.push(parsed);
    }
  }

  const lookDrafts: VtonLookSpec[] = [];
  if (Array.isArray(o.lookDrafts)) {
    for (const row of o.lookDrafts.slice(0, ECOM_VTON_MAX_BATCH_LOOKS)) {
      const parsed = sanitizeLookSpec(row);
      if (parsed) lookDrafts.push(parsed);
    }
  }

  const lockedLooks: VtonLockedLook[] = [];
  if (Array.isArray(o.lockedLooks)) {
    for (const row of o.lockedLooks) {
      const parsed = sanitizeLockedLook(row);
      if (parsed) lockedLooks.push(parsed);
    }
  }

  const tryonBatch = sanitizeTryonBatch(o.tryonBatch);

  let tryonBatchCancelBatchId: string | null | undefined;
  if (o.tryonBatchCancelBatchId === null) tryonBatchCancelBatchId = null;
  else if (typeof o.tryonBatchCancelBatchId === "string") {
    tryonBatchCancelBatchId = o.tryonBatchCancelBatchId;
  }

  let tryonProgress: VtonTryonProgress | null | undefined;
  if (o.tryonProgress === null) tryonProgress = null;
  else if (o.tryonProgress && typeof o.tryonProgress === "object") {
    tryonProgress = o.tryonProgress as VtonTryonProgress;
  }

  const tryonHistory = Array.isArray(o.tryonHistory)
    ? (o.tryonHistory as VtonTryonHistoryEntry[])
    : undefined;

  const modelGenerations = sanitizeModelGenerations(o.modelGenerations);
  const previewModelGenerationId =
    typeof o.previewModelGenerationId === "string" ? o.previewModelGenerationId : undefined;
  const confirmedModelGenerationIds = Array.isArray(o.confirmedModelGenerationIds)
    ? o.confirmedModelGenerationIds.filter((id): id is string => typeof id === "string")
    : undefined;
  const activeModelGenerationId =
    typeof o.activeModelGenerationId === "string" ? o.activeModelGenerationId : undefined;

  const textTryonRefs: VtonTextTryonRef[] = [];
  if (Array.isArray(o.textTryonRefs)) {
    for (const row of o.textTryonRefs) {
      const parsed = sanitizeTextTryonRef(row);
      if (parsed) textTryonRefs.push(parsed);
    }
  }

  const textTryonResults: VtonTextTryonResult[] = [];
  if (Array.isArray(o.textTryonResults)) {
    for (const row of o.textTryonResults) {
      const parsed = parseVtonTextTryonResult(row);
      if (parsed) textTryonResults.push(parsed);
    }
  }

  const textTryonPrompt =
    typeof o.textTryonPrompt === "string" ? o.textTryonPrompt : undefined;

  const textTryonDemoSuppressed = o.textTryonDemoSuppressed === true ? true : undefined;

  const base: VtonProjectMeta = {
    garmentPool,
    lookDrafts,
    lockedLooks,
    tryonBatch: tryonBatch === undefined ? null : tryonBatch,
    defaultLockedLookId:
      typeof o.defaultLockedLookId === "string" ? o.defaultLockedLookId : undefined,
    ...(tryonBatchCancelBatchId !== undefined ? { tryonBatchCancelBatchId } : {}),
    ...(tryonProgress !== undefined ? { tryonProgress } : {}),
    ...(tryonHistory ? { tryonHistory } : {}),
    ...(modelGenerations.length ? { modelGenerations } : {}),
    ...(previewModelGenerationId ? { previewModelGenerationId } : {}),
    ...(confirmedModelGenerationIds?.length ? { confirmedModelGenerationIds } : {}),
    ...(activeModelGenerationId ? { activeModelGenerationId } : {}),
    ...(textTryonRefs.length ? { textTryonRefs } : {}),
    ...(textTryonPrompt !== undefined ? { textTryonPrompt } : {}),
    ...(textTryonResults.length ? { textTryonResults } : {}),
    ...(textTryonDemoSuppressed ? { textTryonDemoSuppressed } : {}),
  };

  return modelGenerations.length ? finalizeModelGenerationsMeta(base) : base;
}

export function mergeVtonMeta(
  existing: unknown,
  patch: Partial<VtonProjectMeta>,
): VtonProjectMeta {
  const base = sanitizeVtonProjectMeta(existing);
  const merged: VtonProjectMeta = {
    ...base,
    ...patch,
    garmentPool: patch.garmentPool ?? base.garmentPool,
    lookDrafts: patch.lookDrafts ?? base.lookDrafts,
    lockedLooks: patch.lockedLooks ?? base.lockedLooks,
    tryonBatch: patch.tryonBatch !== undefined ? patch.tryonBatch : base.tryonBatch,
    tryonBatchCancelBatchId:
      patch.tryonBatchCancelBatchId !== undefined
        ? patch.tryonBatchCancelBatchId
        : base.tryonBatchCancelBatchId,
    tryonProgress: patch.tryonProgress !== undefined ? patch.tryonProgress : base.tryonProgress,
    defaultLockedLookId:
      patch.defaultLockedLookId !== undefined ? patch.defaultLockedLookId : base.defaultLockedLookId,
    modelGenerations: patch.modelGenerations ?? base.modelGenerations,
    previewModelGenerationId:
      patch.previewModelGenerationId !== undefined
        ? patch.previewModelGenerationId
        : base.previewModelGenerationId,
    confirmedModelGenerationIds:
      patch.confirmedModelGenerationIds !== undefined
        ? patch.confirmedModelGenerationIds
        : base.confirmedModelGenerationIds,
    activeModelGenerationId:
      patch.activeModelGenerationId !== undefined
        ? patch.activeModelGenerationId
        : base.activeModelGenerationId,
    textTryonRefs: patch.textTryonRefs ?? base.textTryonRefs,
    textTryonPrompt:
      patch.textTryonPrompt !== undefined ? patch.textTryonPrompt : base.textTryonPrompt,
    textTryonResults: patch.textTryonResults ?? base.textTryonResults,
  };
  return merged.modelGenerations?.length
    ? finalizeModelGenerationsMeta(merged)
    : merged;
}

export function resolveDefaultLockedLookUrl(meta: VtonProjectMeta): string | null {
  const locked = meta.lockedLooks ?? [];
  if (locked.length === 0) return null;
  const picked =
    locked.find((l) => l.id === meta.defaultLockedLookId) ?? locked[0]!;
  return picked.ossUrl.trim() || null;
}

export function syncRefsDressedImageFromLocked(
  refs: WorkflowRefs,
  meta: VtonProjectMeta,
): WorkflowRefs {
  const url = resolveDefaultLockedLookUrl(meta);
  if (!url) {
    const next = { ...refs };
    delete next.dressedImage;
    return next;
  }
  const locked =
    meta.lockedLooks?.find((l) => l.id === meta.defaultLockedLookId) ??
    meta.lockedLooks?.[0];
  return {
    ...refs,
    dressedImage: {
      ossUrl: url,
      source: locked?.source === "upload" ? "upload" : "aitryon-plus",
      label: locked?.label ?? "穿搭参考",
    },
  };
}

export function newGarmentId(): string {
  return randomUUID();
}

export function newLookId(): string {
  return randomUUID();
}

export function newLockedLookId(): string {
  return randomUUID();
}
