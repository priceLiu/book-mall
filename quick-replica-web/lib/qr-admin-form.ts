import type { QrTemplate } from "@/lib/qr-template-types";

export function isMotionSyncKind(kind: string, toolKey?: string): boolean {
  return kind === "motion-sync" || toolKey === "motion-sync";
}

/** 角色库编辑已有条目：只改标题/提示词，不展示封面 URL 与上传 */
export function isCharacterCatalogEdit(form: {
  category: string;
  source: string;
  dbId: string | null;
  catalogBuiltinId: string | null;
}): boolean {
  if (form.category !== "character") return false;
  if (form.source === "new" && !form.dbId && !form.catalogBuiltinId) return false;
  return true;
}

export function extractAdminFormFieldsFromTemplate(t: {
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  reference?: QrTemplate["reference"];
  output?: QrTemplate["output"];
}) {
  const ref = t.reference;
  const outputUrl = t.output?.url?.trim() ?? "";
  const referenceVideoUrl =
    ref?.slots.referenceVideo?.url?.trim() || outputUrl || "";
  const targetImageUrl = ref?.slots.targetImage?.url?.trim() ?? "";
  return {
    promptText: ref?.prompt.text ?? "",
    mediaUrl: outputUrl || referenceVideoUrl || t.thumbnailUrl,
    targetImageUrl,
    referenceVideoUrl,
    outputUrl,
    modelKey: ref?.model.modelKey ?? "",
    toolKey: t.toolKey ?? (t.kind === "motion-sync" ? "motion-sync" : undefined),
  };
}
