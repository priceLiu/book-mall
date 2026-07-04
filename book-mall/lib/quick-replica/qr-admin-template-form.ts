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
  sceneImageUrls?: string[];
  sortOrder?: number;
  existingReference?: QrTemplateJson["reference"];
  existingOutput?: QrTemplateJson["output"];
  voiceId?: string;
  audioStyleTag?: string;
  voiceSpeed?: number;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  voiceStyleExaggeration?: number;
};

export const ADMIN_SCENE_IMAGE_MAX = 9;

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
  sceneImageUrls: string[];
} {
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

function applySceneImagesToSlots(
  slots: QrTemplateJson["reference"]["slots"],
  input: AdminTemplateFormInput,
): void {
  if (input.sceneImageUrls === undefined) return;
  const urls = input.sceneImageUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length > 0) {
    slots.sceneImages = urls.map((url) => ({ url }));
  }
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
    applySceneImagesToSlots(slots, input);

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
        : input.category === "audio"
          ? "eleven_multilingual_v2"
          : input.kind === "edit-image"
            ? "gpt-image-2"
            : "lib-nano-pro");
  const role =
    input.category === "video" ? "VIDEO" : input.category === "audio" ? "AUDIO" : "IMAGE";

  const slots: QrTemplateJson["reference"]["slots"] = {};
  if (input.category === "audio") {
    // 旁白模板无媒体 slot，参数写入 model.params
  } else if (input.category === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl)) {
    slots.referenceVideo = { url: mediaUrl };
  } else if (input.kind === "edit-image" || input.toolKey === "edit-image") {
    slots.targetImage = { url: mediaUrl };
  }
  applySceneImagesToSlots(slots, input);

  const audioParams =
    input.category === "audio"
      ? {
          voice_id: input.voiceId ?? input.existingReference?.model.params.voice_id ?? "khanh-tu",
          style_tag:
            input.audioStyleTag ??
            input.existingReference?.model.params.style_tag ??
            "ad-teaser",
          speed:
            input.voiceSpeed ??
            (typeof input.existingReference?.model.params.speed === "number"
              ? input.existingReference.model.params.speed
              : 1),
          stability:
            input.voiceStability ??
            (typeof input.existingReference?.model.params.stability === "number"
              ? input.existingReference.model.params.stability
              : 0.5),
          similarity_boost:
            input.voiceSimilarityBoost ??
            (typeof input.existingReference?.model.params.similarity_boost === "number"
              ? input.existingReference.model.params.similarity_boost
              : 0.75),
          style_exaggeration:
            input.voiceStyleExaggeration ??
            (typeof input.existingReference?.model.params.style_exaggeration === "number"
              ? input.existingReference.model.params.style_exaggeration
              : 0),
        }
      : {};

  return {
    slots,
    prompt: { text: input.promptText, locale: promptLocale },
    model: {
      role,
      modelKey,
      params:
        input.category === "audio"
          ? audioParams
          : (input.existingReference?.model.params ?? {}),
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
    sceneImageUrls: Array.isArray(body.sceneImageUrls)
      ? body.sceneImageUrls.filter((v): v is string => typeof v === "string")
      : undefined,
    voiceId: typeof body.voiceId === "string" ? body.voiceId : undefined,
    audioStyleTag: typeof body.audioStyleTag === "string" ? body.audioStyleTag : undefined,
    voiceSpeed: typeof body.voiceSpeed === "number" ? body.voiceSpeed : undefined,
    voiceStability: typeof body.voiceStability === "number" ? body.voiceStability : undefined,
    voiceSimilarityBoost:
      typeof body.voiceSimilarityBoost === "number" ? body.voiceSimilarityBoost : undefined,
    voiceStyleExaggeration:
      typeof body.voiceStyleExaggeration === "number" ? body.voiceStyleExaggeration : undefined,
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
  const isAudio = /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(mediaUrl);
  return {
    mediaType: isVideo ? "video" : isAudio ? "audio" : "image",
    url: mediaUrl,
    createdAt: input.existingOutput?.createdAt ?? new Date().toISOString(),
  };
}
