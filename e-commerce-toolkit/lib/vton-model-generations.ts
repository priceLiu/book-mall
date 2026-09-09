import type { VtonModelGeneration, VtonModelImageCheck, VtonProjectMeta } from "@/lib/vton-types";

export function sortModelGenerationsNewestFirst(
  list: VtonModelGeneration[],
): VtonModelGeneration[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function resolvePreviewModelGeneration(
  meta: VtonProjectMeta | null | undefined,
): VtonModelGeneration | null {
  const list = meta?.modelGenerations ?? [];
  if (list.length < 1) return null;
  const previewId = meta?.previewModelGenerationId?.trim();
  if (previewId) {
    const hit = list.find((g) => g.id === previewId);
    if (hit) return hit;
  }
  return sortModelGenerationsNewestFirst(list)[0] ?? null;
}

export function resolveActiveModelGeneration(
  meta: VtonProjectMeta | null | undefined,
): VtonModelGeneration | null {
  const list = meta?.modelGenerations ?? [];
  if (list.length < 1) return null;
  const activeId = meta?.activeModelGenerationId?.trim();
  if (activeId) {
    const hit = list.find((g) => g.id === activeId);
    if (hit) return hit;
  }
  const confirmed = resolveConfirmedModelGenerations(meta);
  return confirmed[confirmed.length - 1] ?? null;
}

export function resolveConfirmedModelGenerations(
  meta: VtonProjectMeta | null | undefined,
): VtonModelGeneration[] {
  const list = meta?.modelGenerations ?? [];
  if (list.length < 1) return [];
  const byId = new Map(list.map((g) => [g.id, g]));
  const ids = meta?.confirmedModelGenerationIds ?? [];
  return ids
    .map((id) => byId.get(id))
    .filter((g): g is VtonModelGeneration => !!g?.confirmedAt?.trim());
}

export function isModelGenerationConfirmed(
  meta: VtonProjectMeta | null | undefined,
  generationId: string,
): boolean {
  const id = generationId.trim();
  if (!(meta?.confirmedModelGenerationIds ?? []).includes(id)) return false;
  const generation = (meta?.modelGenerations ?? []).find((g) => g.id === id);
  return !!generation?.confirmedAt?.trim();
}

export function modelGenerationLabel(
  generation: VtonModelGeneration,
  index: number,
): string {
  return generation.label?.trim() || `模特 ${index + 1}`;
}

export function previewModelBodyHint(
  preview: VtonModelGeneration | null,
  modelImageCheck: VtonModelImageCheck | null | undefined,
): string | null {
  if (!preview?.ossUrl) return null;
  if (!modelImageCheck || modelImageCheck.ossUrl !== preview.ossUrl) {
    return "正在识别模特取景…";
  }
  if (modelImageCheck.isFullBody) {
    return modelImageCheck.fromAiFourView
      ? "全身模特，可确认加入待试衣。"
      : "全身模特照，可确认加入待试衣。";
  }
  if (modelImageCheck.shotType === "portrait" || modelImageCheck.shotType === "half_body") {
    return "当前为头像/半身，请先「头像生成全身图」后再确认试衣。";
  }
  return "未识别为全身照，请上传全身图或 AI 生成全身模特。";
}

export function canConfirmModelGeneration(
  preview: VtonModelGeneration | null,
  modelImageCheck: VtonModelImageCheck | null | undefined,
): boolean {
  if (!preview) return false;
  if (preview.source === "ai-generate") return true;
  if (!modelImageCheck || modelImageCheck.ossUrl !== preview.ossUrl) return false;
  return modelImageCheck.isFullBody;
}
