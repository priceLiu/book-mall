import { randomUUID } from "crypto";

import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import type {
  VtonGarmentItem,
  VtonLockedLook,
  VtonLookSpec,
  VtonProjectMeta,
  VtonTryonBatchState,
  VtonTryonHistoryEntry,
  VtonTryonProgress,
  VtonTryonResult,
} from "@/lib/ecom/ecom-vton/types";
import { ECOM_VTON_MAX_BATCH_LOOKS } from "@/lib/ecom/ecom-vton/types";

const GARMENT_KINDS = new Set(["top", "bottom", "one_piece"]);
const LOOK_KINDS = new Set(["two_piece", "one_piece", "top_only", "bottom_only"]);

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
  return {
    id,
    kind: kind as VtonGarmentItem["kind"],
    ossUrl,
    label: typeof o.label === "string" ? o.label : undefined,
    source:
      typeof o.source === "string"
        ? (o.source as VtonGarmentItem["source"])
        : undefined,
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
      status !== "failed")
  ) {
    return null;
  }
  return {
    id,
    lookId,
    status,
    ossUrl: typeof o.ossUrl === "string" ? o.ossUrl : undefined,
    failReason: typeof o.failReason === "string" ? o.failReason : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
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
    (status !== "running" && status !== "done" && status !== "failed")
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

  let tryonProgress: VtonTryonProgress | null | undefined;
  if (o.tryonProgress === null) tryonProgress = null;
  else if (o.tryonProgress && typeof o.tryonProgress === "object") {
    tryonProgress = o.tryonProgress as VtonTryonProgress;
  }

  const tryonHistory = Array.isArray(o.tryonHistory)
    ? (o.tryonHistory as VtonTryonHistoryEntry[])
    : undefined;

  return {
    garmentPool,
    lookDrafts,
    lockedLooks,
    tryonBatch: tryonBatch === undefined ? null : tryonBatch,
    defaultLockedLookId:
      typeof o.defaultLockedLookId === "string" ? o.defaultLockedLookId : undefined,
    ...(tryonProgress !== undefined ? { tryonProgress } : {}),
    ...(tryonHistory ? { tryonHistory } : {}),
  };
}

export function mergeVtonMeta(
  existing: unknown,
  patch: Partial<VtonProjectMeta>,
): VtonProjectMeta {
  const base = sanitizeVtonProjectMeta(existing);
  return {
    ...base,
    ...patch,
    garmentPool: patch.garmentPool ?? base.garmentPool,
    lookDrafts: patch.lookDrafts ?? base.lookDrafts,
    lockedLooks: patch.lockedLooks ?? base.lockedLooks,
  };
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
