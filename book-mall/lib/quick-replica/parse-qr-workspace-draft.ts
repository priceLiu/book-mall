import type { QrCategory, QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

function parseCategory(raw: unknown): QrCategory | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim() as QrCategory;
  if (v === "video" || v === "image" || v === "character" || v === "world" || v === "audio") {
    return v;
  }
  return null;
}

function parseOptionalNumber(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function parseMusicMode(raw: unknown): QrWorkspaceDraft["musicMode"] {
  if (raw === "generate" || raw === "cover" || raw === "lyrics") return raw;
  return undefined;
}

/** Platform API：从 JSON body 解析完整工作区草稿（含 audio 音色字段） */
export function parseQrWorkspaceDraft(body: Record<string, unknown>): QrWorkspaceDraft | null {
  const category = parseCategory(body.category);
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!category || !kind) return null;

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : "lib-nano-pro";

  return {
    category,
    kind,
    toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    savedTemplateId:
      typeof body.savedTemplateId === "string" ? body.savedTemplateId : undefined,
    targetImageUrl: typeof body.targetImageUrl === "string" ? body.targetImageUrl : "",
    referenceVideoUrl:
      typeof body.referenceVideoUrl === "string" ? body.referenceVideoUrl : "",
    referenceAudioUrl:
      typeof body.referenceAudioUrl === "string" ? body.referenceAudioUrl : "",
    sceneImageUrls: Array.isArray(body.sceneImageUrls)
      ? body.sceneImageUrls.filter((u): u is string => typeof u === "string")
      : [],
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    modelKey,
    mode: typeof body.mode === "string" ? body.mode : undefined,
    characterOrientation:
      typeof body.characterOrientation === "string" ? body.characterOrientation : undefined,
    keepOriginalSound:
      typeof body.keepOriginalSound === "boolean" ? body.keepOriginalSound : undefined,
    resolution: typeof body.resolution === "string" ? body.resolution : undefined,
    aspectRatio: typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
    duration: parseOptionalNumber(body.duration),
    outputFormat: typeof body.outputFormat === "string" ? body.outputFormat : undefined,
    voiceId: typeof body.voiceId === "string" ? body.voiceId : undefined,
    audioStyleTag: typeof body.audioStyleTag === "string" ? body.audioStyleTag : undefined,
    voiceSpeed: parseOptionalNumber(body.voiceSpeed),
    voiceVolume: parseOptionalNumber(body.voiceVolume),
    voicePitch: parseOptionalNumber(body.voicePitch),
    voiceTone: parseOptionalNumber(body.voiceTone),
    voiceIntensity: parseOptionalNumber(body.voiceIntensity),
    voiceTimbre: parseOptionalNumber(body.voiceTimbre),
    voiceStability: parseOptionalNumber(body.voiceStability),
    voiceSimilarityBoost: parseOptionalNumber(body.voiceSimilarityBoost),
    voiceStyleExaggeration: parseOptionalNumber(body.voiceStyleExaggeration),
    sourceAudioUrl: typeof body.sourceAudioUrl === "string" ? body.sourceAudioUrl : undefined,
    musicMode: parseMusicMode(body.musicMode),
  };
}
