/**
 * Gateway 日志 → 计费类别 / 视频形态分类（平台代付报表与结算共用）。
 */
import type { ByokTaskKind } from "@prisma/client";

/** 与 BillingCategory 前五类对齐的展示标签 */
export const BILLING_TASK_KIND_LABEL: Record<ByokTaskKind, string> = {
  TEXT_TO_IMAGE: "文生图（含试衣）",
  IMAGE_TO_VIDEO: "图生视频",
  VIDEO_TO_VIDEO: "视频生视频",
  VIDEO_UNDERSTANDING: "视频理解",
  TTS: "TTS / 语音",
};

/** 从 Gateway 日志解析试衣模型 key（用于明细按模型归类）。 */
export function extractTryonModelKey(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
  inputSummary?: unknown;
}): string {
  const fromSummary =
    log.inputSummary && typeof log.inputSummary === "object" && !Array.isArray(log.inputSummary)
      ? String((log.inputSummary as Record<string, unknown>).model ?? "").trim()
      : "";
  return (log.canonicalModelKey ?? log.model ?? fromSummary ?? "aitryon").trim() || "aitryon";
}

function chatMessagesFromInputSummary(inputSummary: unknown): unknown[] {
  if (!inputSummary || typeof inputSummary !== "object" || Array.isArray(inputSummary)) return [];
  const input = (inputSummary as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const messages = (input as Record<string, unknown>).messages;
  return Array.isArray(messages) ? messages : [];
}

function messageContentParts(content: unknown): unknown[] {
  if (Array.isArray(content)) return content;
  if (content != null && typeof content === "object") return [content];
  return [];
}

/** CHAT 请求是否含 video_url 多模态部件（视频理解）。 */
export function hasVideoAttachmentInChatInput(inputSummary: unknown): boolean {
  for (const msg of chatMessagesFromInputSummary(inputSummary)) {
    if (!msg || typeof msg !== "object") continue;
    for (const part of messageContentParts((msg as Record<string, unknown>).content)) {
      if (!part || typeof part !== "object") continue;
      if ((part as Record<string, unknown>).type === "video_url") return true;
    }
  }
  return false;
}

function isVideoToVideoInput(inputSummary: unknown): boolean {
  const s =
    inputSummary && typeof inputSummary === "object" && !Array.isArray(inputSummary)
      ? (inputSummary as Record<string, unknown>)
      : null;
  if (!s) return false;
  const nested =
    s.input && typeof s.input === "object" && !Array.isArray(s.input)
      ? (s.input as Record<string, unknown>)
      : null;
  return Boolean(
    s.sourceVideo ||
      s.videoUrl ||
      s.referenceVideo ||
      s.mode === "v2v" ||
      s.taskType === "video2video" ||
      nested?.sourceVideo ||
      nested?.videoUrl ||
      nested?.referenceVideo ||
      nested?.mode === "v2v" ||
      nested?.taskType === "video2video",
  );
}

function videoInputRecord(inputSummary: unknown): Record<string, unknown> | null {
  if (!inputSummary || typeof inputSummary !== "object" || Array.isArray(inputSummary)) {
    return null;
  }
  const root = inputSummary as Record<string, unknown>;
  const nested =
    root.input && typeof root.input === "object" && !Array.isArray(root.input)
      ? (root.input as Record<string, unknown>)
      : null;
  return nested ?? root;
}

function hasReferenceImageInVideoInput(inputSummary: unknown): boolean {
  const input = videoInputRecord(inputSummary);
  if (!input) return false;
  const imageFields = [
    "imageUrl",
    "image_url",
    "firstFrameUrl",
    "first_frame_url",
    "firstFrameImage",
    "first_frame_image",
    "imgUrl",
    "img_url",
  ];
  for (const key of imageFields) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) return true;
  }
  const refArrays = [
    input.referenceImageUrls,
    input.reference_image_urls,
    input.image_urls,
    input.imageUrls,
    input.referenceImages,
    input.reference_images,
  ];
  for (const arr of refArrays) {
    if (Array.isArray(arr) && arr.some((u) => typeof u === "string" && u.trim())) {
      return true;
    }
  }
  const assetRefs = input.assetRefs ?? input.asset_refs;
  if (Array.isArray(assetRefs)) {
    for (const ref of assetRefs) {
      if (!ref || typeof ref !== "object") continue;
      const role = String((ref as Record<string, unknown>).role ?? "");
      if (role === "first_frame" || role === "last_frame" || role === "reference_image") {
        return true;
      }
    }
  }
  return false;
}

/** VIDEO 请求是否为纯文生视频（无首帧/参考图；与图生视频区分）。 */
export function isTextToVideoInput(inputSummary: unknown): boolean {
  if (isVideoToVideoInput(inputSummary)) return false;
  const input = videoInputRecord(inputSummary);
  if (!input) return false;
  if (hasReferenceImageInVideoInput(inputSummary)) return false;

  const model = String(input.model ?? "").trim().toLowerCase();
  if (
    model.includes("text-to-video") ||
    model.includes("text_to_video") ||
    model.includes("/t2v") ||
    model.endsWith("-t2v")
  ) {
    return true;
  }

  const prompt = input.prompt;
  return typeof prompt === "string" && prompt.trim().length > 0;
}

/** 将 Gateway 日志映射为计费任务类型。纯 CHAT 文字返回 null。 */
export function mapLogToBillingTaskKind(log: {
  requestKind: string;
  inputSummary?: unknown;
}): ByokTaskKind | null {
  if (log.requestKind === "TTS") return "TTS";
  if (log.requestKind === "IMAGE" || log.requestKind === "TRYON") return "TEXT_TO_IMAGE";
  if (log.requestKind === "CHAT") {
    if (hasVideoAttachmentInChatInput(log.inputSummary)) return "VIDEO_UNDERSTANDING";
    return null;
  }
  if (log.requestKind === "VIDEO") {
    if (isVideoToVideoInput(log.inputSummary)) return "VIDEO_TO_VIDEO";
    return "IMAGE_TO_VIDEO";
  }
  return null;
}
