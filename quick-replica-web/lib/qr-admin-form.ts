import type { QrTemplate } from "@/lib/qr-template-types";

export function isMotionSyncKind(kind: string, toolKey?: string): boolean {
  return kind === "motion-sync" || toolKey === "motion-sync";
}

/** 管理后台模板可配置多张引用图（复制到工作区「选择科目」） */
export function supportsAdminSceneImages(form: {
  category: string;
  kind: string;
  toolKey?: string;
}): boolean {
  if (isMotionSyncKind(form.kind, form.toolKey)) return false;
  if (form.category === "character") return false;
  return form.category === "video" || form.category === "world";
}

export const ADMIN_SCENE_IMAGE_MAX = 9;

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
  const sceneImageUrlsRaw =
    ref?.slots.sceneImages?.map((s) => s.url.trim()).filter(Boolean) ?? [];
  const sceneImageUrls =
    sceneImageUrlsRaw.length > 0
      ? sceneImageUrlsRaw
      : t.kind === "create-world" && t.thumbnailUrl?.trim()
        ? [t.thumbnailUrl.trim()]
        : [];
  return {
    promptText: ref?.prompt.text ?? "",
    mediaUrl: outputUrl || referenceVideoUrl || t.thumbnailUrl,
    targetImageUrl,
    referenceVideoUrl,
    outputUrl,
    modelKey: ref?.model.modelKey ?? "",
    toolKey: t.toolKey ?? (t.kind === "motion-sync" ? "motion-sync" : undefined),
    sceneImageUrls,
  };
}
