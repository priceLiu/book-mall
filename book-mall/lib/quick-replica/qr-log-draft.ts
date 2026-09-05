import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

/** GatewayRequestLog.inputSummary 上各 QR 业务快照键 */
export const QR_INPUT_SUMMARY_SNAP_KEYS = [
  "qrGenerate",
  "qrMotionSync",
  "qrTextToVideo",
  "qrTextToImage",
  "qrTextToAudio",
  "qrVoiceChanger",
  "qrVoiceClone",
  "qrCreateMusic",
  "qrSfx",
  "qrWorld",
] as const;

export function hasQrInputSummarySnap(inputSummary: unknown): boolean {
  if (!inputSummary || typeof inputSummary !== "object") return false;
  const root = inputSummary as Record<string, unknown>;
  return QR_INPUT_SUMMARY_SNAP_KEYS.some((k) => root[k] != null);
}

/** 从日志 inputSummary 还原工作区草稿（生成记录 / 保存模板共用） */
export function readQrDraftFromInputSummary(
  inputSummary: unknown,
  fallbackModel = "",
): QrWorkspaceDraft | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  let snap: unknown;
  for (const key of QR_INPUT_SUMMARY_SNAP_KEYS) {
    if (root[key] != null) {
      snap = root[key];
      break;
    }
  }
  if (!snap || typeof snap !== "object") return null;
  const s = snap as Record<string, unknown>;
  if (s.draft && typeof s.draft === "object") {
    return s.draft as QrWorkspaceDraft;
  }
  if (typeof s.targetImageUrl === "string") {
    return {
      category: "video",
      kind: "motion-sync",
      toolKey: "motion-sync",
      targetImageUrl: String(s.targetImageUrl ?? ""),
      referenceVideoUrl: String(s.referenceVideoUrl ?? ""),
      referenceAudioUrl: "",
      sceneImageUrls: [],
      prompt: String(s.prompt ?? ""),
      modelKey: String(s.modelKey ?? fallbackModel),
      mode: typeof s.mode === "string" ? s.mode : undefined,
      characterOrientation:
        typeof s.characterOrientation === "string"
          ? s.characterOrientation
          : undefined,
    };
  }
  return null;
}

export function previewImageUrlFromQrDraft(
  draft: QrWorkspaceDraft | null,
): string | undefined {
  if (!draft) return undefined;
  const target = draft.targetImageUrl?.trim();
  if (target) return target;
  const scene = draft.sceneImageUrls?.find((u) => typeof u === "string" && u.trim());
  return scene?.trim() || undefined;
}
