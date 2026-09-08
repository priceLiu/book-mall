import { randomUUID } from "crypto";

import { runEcomVtonTryOnBatch } from "@/lib/ecom/ecom-vton/batch-tryon";
import {
  mergeVtonMeta,
  newGarmentId,
  newLockedLookId,
  resolveDefaultLockedLookUrl,
  sanitizeVtonProjectMeta,
  syncRefsDressedImageFromLocked,
} from "@/lib/ecom/ecom-vton/meta";
import type {
  VtonGarmentItem,
  VtonLockedLook,
  VtonLookSpec,
  VtonProjectMeta,
} from "@/lib/ecom/ecom-vton/types";
import { ECOM_VTON_MAX_BATCH_LOOKS } from "@/lib/ecom/ecom-vton/types";
import {
  assertBatchLooksValid,
  expandTopBottomCartesianLooks,
} from "@/lib/ecom/ecom-vton/validate";
import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";

export type VtonProjectPatchResult = {
  meta: VtonProjectMeta;
  references?: WorkflowRefs;
};

export function patchVtonGarmentPool(
  metaRaw: unknown,
  opts: {
    add?: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>;
    removeIds?: string[];
  },
): VtonProjectMeta {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  const pool = [...(meta.garmentPool ?? [])];
  const remove = new Set(opts.removeIds ?? []);
  const next = pool.filter((g) => !remove.has(g.id));
  for (const row of opts.add ?? []) {
    next.push({
      id: row.id?.trim() || newGarmentId(),
      kind: row.kind,
      ossUrl: row.ossUrl.trim(),
      label: row.label,
      source: row.source,
    });
  }
  return mergeVtonMeta(meta, { garmentPool: next });
}

export function patchVtonLookDrafts(
  metaRaw: unknown,
  looks: VtonLookSpec[],
): VtonProjectMeta {
  assertBatchLooksValid(looks);
  const meta = sanitizeVtonProjectMeta(metaRaw);
  return mergeVtonMeta(meta, { lookDrafts: looks.slice(0, ECOM_VTON_MAX_BATCH_LOOKS) });
}

export function buildCartesianLookDrafts(opts: {
  metaRaw: unknown;
  topIds: string[];
  bottomIds: string[];
}): VtonProjectMeta {
  const looks = expandTopBottomCartesianLooks({
    topIds: opts.topIds,
    bottomIds: opts.bottomIds,
    createId: newGarmentId,
  });
  return patchVtonLookDrafts(opts.metaRaw, looks);
}

export async function runVtonProjectBatchTryon(opts: {
  userId: string;
  projectId: string;
  consumerToolKey: string;
  modelUrl: string;
  metaRaw: unknown;
  looks?: VtonLookSpec[];
  persistMeta: (meta: VtonProjectMeta) => Promise<void>;
}): Promise<VtonProjectMeta> {
  const meta = sanitizeVtonProjectMeta(opts.metaRaw);
  const looks = opts.looks ?? meta.lookDrafts ?? [];
  const garmentPool = meta.garmentPool ?? [];

  let workingMeta = mergeVtonMeta(meta, {
    tryonBatch: {
      batchId: randomUUID(),
      status: "running",
      currentIndex: 0,
      total: looks.length,
      label: "排队中…",
      results: [],
      updatedAt: new Date().toISOString(),
    },
    tryonProgress: { phase: "submitting", label: "批量试衣开始…", updatedAt: new Date().toISOString() },
  });
  await opts.persistMeta(workingMeta);

  const batch = await runEcomVtonTryOnBatch({
    userId: opts.userId,
    consumerToolKey: opts.consumerToolKey,
    projectId: opts.projectId,
    modelUrl: opts.modelUrl,
    looks,
    garmentPool,
    onProgress: async ({ batch: b }) => {
      workingMeta = mergeVtonMeta(workingMeta, {
        tryonBatch: b,
        tryonProgress: {
          phase: b.status === "running" ? "polling" : b.status === "done" ? "done" : "failed",
          label: b.label ?? "批量试衣中…",
          updatedAt: b.updatedAt,
        },
      });
      await opts.persistMeta(workingMeta);
    },
  });

  workingMeta = mergeVtonMeta(workingMeta, {
    tryonBatch: batch,
    tryonProgress: {
      phase: batch.status === "done" ? "done" : "failed",
      label: batch.label ?? "批量试衣完成",
      updatedAt: batch.updatedAt,
    },
  });
  await opts.persistMeta(workingMeta);
  return workingMeta;
}

export function lockVtonTryonResults(
  metaRaw: unknown,
  resultIds: string[],
  refs?: WorkflowRefs,
): VtonProjectPatchResult {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  const batch = meta.tryonBatch;
  if (!batch?.results?.length) throw new Error("暂无试衣结果可锁定");

  const idSet = new Set(resultIds);
  const toLock = batch.results.filter((r) => idSet.has(r.id) && r.status === "success" && r.ossUrl);
  if (toLock.length === 0) throw new Error("请选择试衣成功的结果");

  const lockedLooks = [...(meta.lockedLooks ?? [])];
  for (const r of toLock) {
    if (lockedLooks.some((l) => l.resultId === r.id)) continue;
    lockedLooks.push({
      id: newLockedLookId(),
      ossUrl: r.ossUrl!,
      label: meta.lookDrafts?.find((l) => l.id === r.lookId)?.label ?? "试衣成片",
      source: "aitryon-plus",
      resultId: r.id,
      lockedAt: new Date().toISOString(),
    });
  }

  let defaultLockedLookId = meta.defaultLockedLookId;
  if (!defaultLockedLookId && lockedLooks.length > 0) {
    defaultLockedLookId = lockedLooks[0]!.id;
  }

  const nextMeta = mergeVtonMeta(meta, { lockedLooks, defaultLockedLookId });
  const references = refs ? syncRefsDressedImageFromLocked(refs, nextMeta) : undefined;
  return { meta: nextMeta, references };
}

export function lockVtonUploadAsLook(
  metaRaw: unknown,
  opts: { ossUrl: string; label?: string },
  refs?: WorkflowRefs,
): VtonProjectPatchResult {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  const lockedLooks: VtonLockedLook[] = [
    ...(meta.lockedLooks ?? []),
    {
      id: newLockedLookId(),
      ossUrl: opts.ossUrl.trim(),
      label: opts.label ?? "已穿搭",
      source: "upload",
      lockedAt: new Date().toISOString(),
    },
  ];
  const nextMeta = mergeVtonMeta(meta, {
    lockedLooks,
    defaultLockedLookId: meta.defaultLockedLookId ?? lockedLooks[0]!.id,
  });
  const references = refs ? syncRefsDressedImageFromLocked(refs, nextMeta) : undefined;
  return { meta: nextMeta, references };
}

export function unlockVtonLockedLook(metaRaw: unknown, lockedLookId: string, refs?: WorkflowRefs): VtonProjectPatchResult {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  const lockedLooks = (meta.lockedLooks ?? []).filter((l) => l.id !== lockedLookId);
  let defaultLockedLookId = meta.defaultLockedLookId;
  if (defaultLockedLookId === lockedLookId) {
    defaultLockedLookId = lockedLooks[0]?.id;
  }
  const nextMeta = mergeVtonMeta(meta, { lockedLooks, defaultLockedLookId });
  const references = refs ? syncRefsDressedImageFromLocked(refs, nextMeta) : undefined;
  return { meta: nextMeta, references };
}

export function setVtonDefaultLockedLook(
  metaRaw: unknown,
  lockedLookId: string,
  refs?: WorkflowRefs,
): VtonProjectPatchResult {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  if (!(meta.lockedLooks ?? []).some((l) => l.id === lockedLookId)) {
    throw new Error("找不到该锁定参考");
  }
  const nextMeta = mergeVtonMeta(meta, { defaultLockedLookId: lockedLookId });
  const references = refs ? syncRefsDressedImageFromLocked(refs, nextMeta) : undefined;
  return { meta: nextMeta, references };
}

export function importVtonLockedLooksFromMeta(
  targetMetaRaw: unknown,
  sourceMetaRaw: unknown,
  opts?: { resultIds?: string[]; lockedLookIds?: string[] },
): VtonProjectMeta {
  const target = sanitizeVtonProjectMeta(targetMetaRaw);
  const source = sanitizeVtonProjectMeta(sourceMetaRaw);
  const resultIdSet = new Set(opts?.resultIds ?? []);
  const lockedIdSet = new Set(opts?.lockedLookIds ?? []);

  const imported: VtonLockedLook[] = [];

  if (resultIdSet.size > 0 && source.tryonBatch?.results) {
    for (const r of source.tryonBatch.results) {
      if (!resultIdSet.has(r.id) || r.status !== "success" || !r.ossUrl) continue;
      imported.push({
        id: newLockedLookId(),
        ossUrl: r.ossUrl,
        label: source.lookDrafts?.find((l) => l.id === r.lookId)?.label ?? "导入试衣",
        source: "import",
        resultId: r.id,
        lockedAt: new Date().toISOString(),
      });
    }
  }

  if (lockedIdSet.size > 0) {
    for (const l of source.lockedLooks ?? []) {
      if (!lockedIdSet.has(l.id)) continue;
      imported.push({
        ...l,
        id: newLockedLookId(),
        source: "import",
        lockedAt: new Date().toISOString(),
      });
    }
  }

  if (imported.length === 0) throw new Error("没有可导入的试衣参考");

  const lockedLooks = [...(target.lockedLooks ?? []), ...imported];
  const defaultLockedLookId = target.defaultLockedLookId ?? lockedLooks[0]?.id;
  return mergeVtonMeta(target, { lockedLooks, defaultLockedLookId });
}

export function assertVtonReadyToFinalizeLock(metaRaw: unknown, outfitRefMode: "already_dressed" | "need_tryon"): void {
  const meta = sanitizeVtonProjectMeta(metaRaw);
  if ((meta.lockedLooks?.length ?? 0) < 1) {
    if (outfitRefMode === "already_dressed") {
      throw new Error("请先锁定已穿搭全身照");
    }
    throw new Error("请先锁定至少 1 张试衣参考");
  }
}

export { resolveDefaultLockedLookUrl, sanitizeVtonProjectMeta, syncRefsDressedImageFromLocked };
