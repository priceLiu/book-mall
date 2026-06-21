import type { QrTemplate } from "@/lib/qr-template-types";

export function isMotionSyncKind(kind: string, toolKey?: string): boolean {
  return kind === "motion-sync" || toolKey === "motion-sync";
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
