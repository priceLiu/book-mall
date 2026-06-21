import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";

export type AdminTemplateFormInput = {
  category: QrCategory;
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  promptText: string;
  mediaUrl?: string;
  targetImageUrl?: string;
  referenceVideoUrl?: string;
  outputUrl?: string;
  modelKey?: string;
  sortOrder?: number;
  existingReference?: QrTemplateJson["reference"];
  existingOutput?: QrTemplateJson["output"];
};

export function isMotionSyncKind(kind: string, toolKey?: string): boolean {
  return kind === "motion-sync" || toolKey === "motion-sync";
}

export function extractAdminFormFieldsFromTemplate(t: {
  kind: string;
  toolKey?: string;
  title: string;
  thumbnailUrl: string;
  reference?: QrTemplateJson["reference"];
  output?: QrTemplateJson["output"];
}): {
  promptText: string;
  mediaUrl: string;
  targetImageUrl: string;
  referenceVideoUrl: string;
  outputUrl: string;
  modelKey: string;
  toolKey?: string;
} {
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

export function buildAdminReference(input: AdminTemplateFormInput): QrTemplateJson["reference"] {
  const promptLocale = /[\u4e00-\u9fff]/.test(input.promptText) ? ("zh" as const) : ("en" as const);

  if (isMotionSyncKind(input.kind, input.toolKey)) {
    const existing = input.existingReference;
    const targetImageUrl =
      input.targetImageUrl?.trim() ||
      existing?.slots.targetImage?.url?.trim() ||
      input.thumbnailUrl.trim();
    const referenceVideoUrl =
      input.referenceVideoUrl?.trim() ||
      input.mediaUrl?.trim() ||
      input.outputUrl?.trim() ||
      existing?.slots.referenceVideo?.url?.trim() ||
      input.existingOutput?.url?.trim() ||
      "";
    const modelKey =
      input.modelKey?.trim() ||
      existing?.model.modelKey ||
      "kling-2.6/motion-control";

    const slots: QrTemplateJson["reference"]["slots"] = {};
    if (targetImageUrl) slots.targetImage = { url: targetImageUrl };
    if (referenceVideoUrl) slots.referenceVideo = { url: referenceVideoUrl };

    return {
      slots,
      prompt: { text: input.promptText, locale: promptLocale },
      model: {
        role: "VIDEO",
        modelKey,
        params: existing?.model.params ?? { mode: "std", character_orientation: "video" },
      },
    };
  }

  const mediaUrl = input.mediaUrl?.trim() || input.thumbnailUrl.trim();
  const modelKey =
    input.modelKey?.trim() ||
    input.existingReference?.model.modelKey ||
    (input.kind === "motion-sync"
      ? "kling-2.6/motion-control"
      : input.category === "video"
        ? "wan/2-6-video-to-video"
        : input.kind === "edit-image"
          ? "gpt-image-2"
          : "lib-nano-pro");
  const role =
    input.category === "video" ? "VIDEO" : input.category === "audio" ? "AUDIO" : "IMAGE";

  const slots: QrTemplateJson["reference"]["slots"] = {};
  if (input.category === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl)) {
    slots.referenceVideo = { url: mediaUrl };
  } else if (input.kind === "edit-image" || input.toolKey === "edit-image") {
    slots.targetImage = { url: mediaUrl };
  }

  return {
    slots,
    prompt: { text: input.promptText, locale: promptLocale },
    model: {
      role,
      modelKey,
      params: input.existingReference?.model.params ?? {},
    },
  };
}

export function parseAdminUpsertOptionalFields(body: Record<string, unknown>) {
  return {
    toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
    mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : undefined,
    targetImageUrl: typeof body.targetImageUrl === "string" ? body.targetImageUrl : undefined,
    referenceVideoUrl:
      typeof body.referenceVideoUrl === "string" ? body.referenceVideoUrl : undefined,
    outputUrl: typeof body.outputUrl === "string" ? body.outputUrl : undefined,
    modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
  };
}

export function buildAdminOutput(
  input: AdminTemplateFormInput,
  reference: QrTemplateJson["reference"],
): QrTemplateJson["output"] | undefined {
  if (isMotionSyncKind(input.kind, input.toolKey)) {
    const url =
      input.outputUrl?.trim() ||
      input.referenceVideoUrl?.trim() ||
      input.mediaUrl?.trim() ||
      reference.slots.referenceVideo?.url?.trim() ||
      input.existingOutput?.url?.trim();
    if (!url) return input.existingOutput;
    return {
      mediaType: "video",
      url,
      createdAt: input.existingOutput?.createdAt ?? new Date().toISOString(),
    };
  }

  const mediaUrl = input.mediaUrl?.trim();
  if (!mediaUrl) return input.existingOutput;
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl);
  return {
    mediaType: isVideo ? "video" : "image",
    url: mediaUrl,
    createdAt: input.existingOutput?.createdAt ?? new Date().toISOString(),
  };
}
