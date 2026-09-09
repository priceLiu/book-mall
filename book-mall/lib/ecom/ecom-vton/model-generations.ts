import { randomUUID } from "crypto";

import type { WorkflowRefImage, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import type {
  VtonModelGeneration,
  VtonModelGenerationBodyCheck,
  VtonProjectMeta,
} from "@/lib/ecom/ecom-vton/types";

const BODY_SHOT_TYPES = new Set(["portrait", "half_body", "full_body", "unknown"]);

function sanitizeGenerationBodyCheck(raw: unknown): VtonModelGenerationBodyCheck | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (status !== "pending" && status !== "done" && status !== "failed") return undefined;
  const shotTypeRaw = typeof o.shotType === "string" ? o.shotType : undefined;
  const shotType = shotTypeRaw && BODY_SHOT_TYPES.has(shotTypeRaw)
    ? (shotTypeRaw as VtonModelGenerationBodyCheck["shotType"])
    : undefined;
  return {
    status,
    ...(shotType ? { shotType } : {}),
    ...(typeof o.isFullBody === "boolean" ? { isFullBody: o.isFullBody } : {}),
    ...(typeof o.checkedAt === "string" ? { checkedAt: o.checkedAt } : {}),
    ...(o.fromAiGenerate === true ? { fromAiGenerate: true } : {}),
  };
}

export function newModelGenerationId(): string {
  return randomUUID();
}

function sanitizeModelGeneration(raw: unknown): VtonModelGeneration | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
  if (!id || !ossUrl) return null;
  const source = o.source;
  return {
    id,
    ossUrl,
    label: typeof o.label === "string" ? o.label : undefined,
    source:
      typeof source === "string"
        ? (source as VtonModelGeneration["source"])
        : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    bodyCheck: sanitizeGenerationBodyCheck(o.bodyCheck),
    confirmedAt: typeof o.confirmedAt === "string" ? o.confirmedAt : undefined,
  };
}

function isGenerationUserConfirmed(generation: VtonModelGeneration): boolean {
  return !!generation.confirmedAt?.trim();
}

export function sanitizeModelGenerations(raw: unknown): VtonModelGeneration[] {
  if (!Array.isArray(raw)) return [];
  const out: VtonModelGeneration[] = [];
  for (const row of raw) {
    const parsed = sanitizeModelGeneration(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

function sanitizeConfirmedIds(raw: unknown, generations: VtonModelGeneration[]): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(generations.map((g) => g.id));
  const out: string[] = [];
  for (const row of raw) {
    if (typeof row !== "string") continue;
    const id = row.trim();
    if (!id || !valid.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

export function sortModelGenerationsNewestFirst(
  list: VtonModelGeneration[],
): VtonModelGeneration[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** 补齐 preview / confirmed / active 一致性（含旧项目迁移） */
export function finalizeModelGenerationsMeta(meta: VtonProjectMeta): VtonProjectMeta {
  const modelGenerations = meta.modelGenerations ?? [];
  if (modelGenerations.length < 1) {
    return {
      ...meta,
      modelGenerations: undefined,
      previewModelGenerationId: undefined,
      confirmedModelGenerationIds: undefined,
      activeModelGenerationId: undefined,
    };
  }

  const confirmedModelGenerationIds = sanitizeConfirmedIds(
    meta.confirmedModelGenerationIds,
    modelGenerations,
  ).filter((id) => {
    const generation = modelGenerations.find((g) => g.id === id);
    return generation ? isGenerationUserConfirmed(generation) : false;
  });

  let previewModelGenerationId = meta.previewModelGenerationId?.trim();
  if (
    !previewModelGenerationId ||
    !modelGenerations.some((g) => g.id === previewModelGenerationId)
  ) {
    previewModelGenerationId = sortModelGenerationsNewestFirst(modelGenerations)[0]!.id;
  }

  let activeModelGenerationId = meta.activeModelGenerationId?.trim();
  if (
    !activeModelGenerationId ||
    !confirmedModelGenerationIds.includes(activeModelGenerationId)
  ) {
    activeModelGenerationId =
      confirmedModelGenerationIds[confirmedModelGenerationIds.length - 1];
  }

  return {
    ...meta,
    modelGenerations,
    ...(confirmedModelGenerationIds.length
      ? { confirmedModelGenerationIds }
      : { confirmedModelGenerationIds: undefined }),
    previewModelGenerationId,
    ...(activeModelGenerationId ? { activeModelGenerationId } : { activeModelGenerationId: undefined }),
  };
}

export function resolvePreviewModelGeneration(
  meta: VtonProjectMeta,
): VtonModelGeneration | null {
  const list = meta.modelGenerations ?? [];
  if (list.length < 1) return null;
  const previewId = meta.previewModelGenerationId?.trim();
  if (previewId) {
    const hit = list.find((g) => g.id === previewId);
    if (hit) return hit;
  }
  return sortModelGenerationsNewestFirst(list)[0] ?? null;
}

export function resolveActiveModelGeneration(
  meta: VtonProjectMeta,
): VtonModelGeneration | null {
  const list = meta.modelGenerations ?? [];
  if (list.length < 1) return null;
  const activeId = meta.activeModelGenerationId?.trim();
  if (activeId) {
    const hit = list.find((g) => g.id === activeId);
    if (hit) return hit;
  }
  const confirmed = resolveConfirmedModelGenerations(meta);
  return confirmed[confirmed.length - 1] ?? null;
}

export function resolveConfirmedModelGenerations(
  meta: VtonProjectMeta,
): VtonModelGeneration[] {
  const list = meta.modelGenerations ?? [];
  if (list.length < 1) return [];
  const byId = new Map(list.map((g) => [g.id, g]));
  const ids = meta.confirmedModelGenerationIds ?? [];
  return ids
    .map((id) => byId.get(id))
    .filter((g): g is VtonModelGeneration => !!g && isGenerationUserConfirmed(g));
}

export function isModelGenerationConfirmed(
  meta: VtonProjectMeta,
  generationId: string,
): boolean {
  const id = generationId.trim();
  if (!(meta.confirmedModelGenerationIds ?? []).includes(id)) return false;
  const generation = (meta.modelGenerations ?? []).find((g) => g.id === id);
  return generation ? isGenerationUserConfirmed(generation) : false;
}

export function ensureModelGenerationsFromRefs(
  meta: VtonProjectMeta,
  refs: WorkflowRefs,
): VtonProjectMeta {
  if ((meta.modelGenerations?.length ?? 0) > 0) {
    return finalizeModelGenerationsMeta(meta);
  }
  const model = refs.model;
  const ossUrl = model?.ossUrl?.trim();
  if (!ossUrl) {
    return finalizeModelGenerationsMeta({
      ...meta,
      modelGenerations: [],
      previewModelGenerationId: undefined,
      confirmedModelGenerationIds: [],
      activeModelGenerationId: undefined,
    });
  }
  const id = newModelGenerationId();
  return finalizeModelGenerationsMeta({
    ...meta,
    modelGenerations: [
      {
        id,
        ossUrl,
        label: model?.label,
        source: model?.source as VtonModelGeneration["source"] | undefined,
        createdAt: new Date().toISOString(),
      },
    ],
    previewModelGenerationId: id,
  });
}

export function refsWithActiveModelGeneration(
  refs: WorkflowRefs,
  meta: VtonProjectMeta,
): WorkflowRefs {
  const active = resolveActiveModelGeneration(meta);
  if (!active) {
    const next = { ...refs };
    delete next.model;
    return next;
  }
  const next: WorkflowRefs = { ...refs };
  delete next.dressedImage;
  next.model = {
    ossUrl: active.ossUrl,
    label: active.label ?? refs.model?.label ?? "模特全身照",
    source: (active.source ?? refs.model?.source ?? "upload") as WorkflowRefImage["source"],
  };
  return next;
}

export function appendModelGeneration(
  meta: VtonProjectMeta,
  entry: {
    ossUrl: string;
    label?: string;
    source?: VtonModelGeneration["source"];
    id?: string;
    createdAt?: string;
    bodyCheck?: VtonModelGenerationBodyCheck;
  },
): { meta: VtonProjectMeta; generation: VtonModelGeneration } {
  const generation: VtonModelGeneration = {
    id: entry.id ?? newModelGenerationId(),
    ossUrl: entry.ossUrl.trim(),
    label: entry.label,
    source: entry.source,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    ...(entry.bodyCheck ? { bodyCheck: entry.bodyCheck } : {}),
  };
  const modelGenerations = [...(meta.modelGenerations ?? []), generation];
  return {
    generation,
    meta: finalizeModelGenerationsMeta({
      ...meta,
      modelGenerations,
      previewModelGenerationId: generation.id,
    }),
  };
}

export function setPreviewModelGeneration(
  meta: VtonProjectMeta,
  generationId: string,
): VtonProjectMeta {
  const id = generationId.trim();
  const hit = (meta.modelGenerations ?? []).some((g) => g.id === id);
  if (!hit) throw new Error("未找到该模特版本");
  return { ...meta, previewModelGenerationId: id };
}

export function confirmModelGeneration(
  meta: VtonProjectMeta,
  generationId: string,
): VtonProjectMeta {
  const id = generationId.trim();
  const hit = (meta.modelGenerations ?? []).some((g) => g.id === id);
  if (!hit) throw new Error("未找到该模特版本");
  const confirmed = [...(meta.confirmedModelGenerationIds ?? [])];
  if (!confirmed.includes(id)) confirmed.push(id);
  const confirmedAt = new Date().toISOString();
  const modelGenerations = (meta.modelGenerations ?? []).map((g) =>
    g.id === id ? { ...g, confirmedAt: g.confirmedAt ?? confirmedAt } : g,
  );
  return finalizeModelGenerationsMeta({
    ...meta,
    modelGenerations,
    confirmedModelGenerationIds: confirmed,
    activeModelGenerationId: id,
    previewModelGenerationId: id,
  });
}

export function unconfirmModelGeneration(
  meta: VtonProjectMeta,
  generationId: string,
): VtonProjectMeta {
  const id = generationId.trim();
  const prev = meta.confirmedModelGenerationIds ?? [];
  const confirmedModelGenerationIds = prev.filter((row) => row !== id);
  if (confirmedModelGenerationIds.length === prev.length) {
    throw new Error("该模特不在待试衣列表中");
  }
  const modelGenerations = (meta.modelGenerations ?? []).map((g) =>
    g.id === id ? { ...g, confirmedAt: undefined } : g,
  );
  return finalizeModelGenerationsMeta({
    ...meta,
    modelGenerations,
    confirmedModelGenerationIds,
  });
}

export function setActiveModelGeneration(
  meta: VtonProjectMeta,
  generationId: string,
): VtonProjectMeta {
  const id = generationId.trim();
  if (!isModelGenerationConfirmed(meta, id)) {
    throw new Error("请先将该模特加入待试衣列表");
  }
  const hit = (meta.modelGenerations ?? []).some((g) => g.id === id);
  if (!hit) throw new Error("未找到该模特版本");
  return { ...meta, activeModelGenerationId: id };
}

export function removeModelGeneration(
  meta: VtonProjectMeta,
  generationId: string,
): VtonProjectMeta {
  const id = generationId.trim();
  const prev = meta.modelGenerations ?? [];
  const modelGenerations = prev.filter((g) => g.id !== id);
  if (modelGenerations.length === prev.length) {
    throw new Error("未找到该模特版本");
  }
  const confirmedModelGenerationIds = (meta.confirmedModelGenerationIds ?? []).filter(
    (row) => row !== id,
  );
  let previewModelGenerationId = meta.previewModelGenerationId;
  if (previewModelGenerationId === id) {
    previewModelGenerationId = sortModelGenerationsNewestFirst(modelGenerations)[0]?.id;
  }
  let activeModelGenerationId = meta.activeModelGenerationId;
  if (activeModelGenerationId === id) {
    activeModelGenerationId = confirmedModelGenerationIds[confirmedModelGenerationIds.length - 1];
  }
  return finalizeModelGenerationsMeta({
    ...meta,
    modelGenerations,
    confirmedModelGenerationIds,
    previewModelGenerationId,
    activeModelGenerationId,
  });
}
