/**
 * 生成失败 · 用户可见四类（全站 Single Writer）。
 * a USER_CREDITS · b PLATFORM_BILLING · c VENDOR_INPUT · d VENDOR_QUEUE
 */

export type GenerationUserFacingBucket =
  | "USER_CREDITS"
  | "PLATFORM_BILLING"
  | "VENDOR_INPUT"
  | "VENDOR_QUEUE";

export const GENERATION_USER_FACING_BUCKET_LABEL: Record<
  GenerationUserFacingBucket,
  string
> = {
  USER_CREDITS: "积分不足",
  PLATFORM_BILLING: "积分不能抵扣",
  VENDOR_INPUT: "模型/参数",
  VENDOR_QUEUE: "厂商排队/其他",
};

export const USER_MESSAGE_PLATFORM_BILLING =
  "积分不能抵扣，请稍候再试，问题已反馈";

export const USER_MESSAGE_VENDOR_QUEUE =
  "模型厂商排队中，请稍候再试，问题已反馈";

export type GenerationHealthModality = "IMAGE" | "VIDEO" | "MULTIMODAL" | "TEXT" | "AUDIO";

export const GENERATION_HEALTH_MODALITY_LABEL: Record<
  GenerationHealthModality,
  string
> = {
  IMAGE: "图片",
  VIDEO: "视频",
  MULTIMODAL: "多模态",
  TEXT: "文本",
  AUDIO: "音频",
};

export const GENERATION_HEALTH_MODALITY_ORDER: GenerationHealthModality[] = [
  "IMAGE",
  "VIDEO",
  "MULTIMODAL",
  "TEXT",
  "AUDIO",
];

const RATE_LIMIT_MARKERS = [
  "rate limit",
  "rate_limit",
  "ratelimit",
  "too many requests",
  "throttl",
  "request rate limit",
] as const;

const CONTENT_POLICY_MARKERS = [
  "flagged as sensitive",
  "content policy",
  "content filter",
  "moderation",
  "安全",
  "违规",
  "敏感",
] as const;

const INVALID_INPUT_MARKERS = [
  "invalid",
  "validation",
  "malformed",
  "bad request",
  "参数",
  "格式",
] as const;

const VENDOR_INPUT_FAIL_CODES = new Set([
  "CONTENT_POLICY",
  "INVALID_INPUT",
  "MODEL_NOT_FOUND",
  "UPSTREAM_RATE_LIMIT",
  "UPSTREAM_AUTH_FAILED",
  "UPSTREAM_INSUFFICIENT_BALANCE",
  "UPSTREAM_FREE_QUOTA",
  "PROVIDER_QUOTA_EXCEEDED",
  "KIE_QUOTA_EXCEEDED",
  "ENGINE_OVERLOADED",
  "OSS_UPLOAD_FAILED",
  "VIDEO_RISK",
  "SUBMIT_BURST_LIMIT",
  "MODEL_DAILY_LIMIT",
]);

const PLATFORM_BILLING_FAIL_CODES = new Set([
  "SYSTEM_BUSY",
  "BILLING_ERROR",
  "SETTLEMENT_FAILED",
  "CREDIT_SETTLE_FAILED",
]);

const VENDOR_QUEUE_FAIL_CODES = new Set([
  "UPSTREAM_TRANSIENT",
  "POLL_TRANSIENT",
  "STALE_TIMEOUT",
  "UNKNOWN",
  "UPSTREAM_SUBMIT_FAILED",
  "SUBMIT_ORPHAN",
  "STALE_ORPHAN",
  "QUEUE_TIMEOUT",
  "SUBMIT_DISPATCH_TIMEOUT",
  "VOLCENGINE_GATEWAY_POLL_STALL",
  "VOLCENGINE_QUEUED_STALE",
  "VOLCENGINE_POLL_LAG",
]);

function normalizeBlob(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isMislabeledInsufficientCreditsLog(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): boolean {
  if (input.failCode?.trim() !== "INSUFFICIENT_CREDITS") return false;
  const blob = normalizeBlob(input.failMessage ?? "");
  return (
    blob.includes("prisma.") ||
    blob.includes("creditledger") ||
    blob.includes("transaction already closed") ||
    blob.includes("interactive transaction timeout") ||
    blob.includes("transaction api error") ||
    blob.includes("pool timeout") ||
    blob.includes("timed out fetching a new connection") ||
    blob.includes("server has closed the connection")
  );
}

export function isRateLimitFail(input: {
  failCode?: string | null;
  failMessage?: string | null;
  httpStatus?: number | null;
}): boolean {
  if (input.httpStatus === 429) return true;
  const code = input.failCode?.trim() ?? "";
  if (
    code === "UPSTREAM_RATE_LIMIT" ||
    code === "SUBMIT_BURST_LIMIT" ||
    code === "MODEL_DAILY_LIMIT"
  ) {
    return true;
  }
  const blob = normalizeBlob(input.failMessage ?? "");
  return RATE_LIMIT_MARKERS.some((m) => blob.includes(m));
}

function isContentPolicy(blob: string, raw?: string | null): boolean {
  const b = blob || normalizeBlob(raw ?? "");
  return CONTENT_POLICY_MARKERS.some((m) => b.includes(m));
}

function isInvalidInput(blob: string, httpStatus?: number | null): boolean {
  if (httpStatus === 400 || httpStatus === 422) {
    if (isContentPolicy(blob)) return false;
    return true;
  }
  return INVALID_INPUT_MARKERS.some((m) => blob.includes(m));
}

export type ClassifyGenerationFailureInput = {
  failCode?: string | null;
  failMessage?: string | null;
  httpStatus?: number | null;
};

export function classifyGenerationUserFacingBucket(
  input: ClassifyGenerationFailureInput,
): GenerationUserFacingBucket {
  const code = input.failCode?.trim() ?? "";
  const msg = input.failMessage?.trim() ?? "";
  const blob = normalizeBlob(`${code} ${msg}`);

  if (isMislabeledInsufficientCreditsLog(input)) {
    return "PLATFORM_BILLING";
  }

  if (code === "INSUFFICIENT_CREDITS" || blob.includes("积分不足")) {
    return "USER_CREDITS";
  }

  if (PLATFORM_BILLING_FAIL_CODES.has(code)) {
    return "PLATFORM_BILLING";
  }

  if (
    blob.includes("transaction already closed") ||
    blob.includes("interactive transaction timeout") ||
    blob.includes("creditledger.create") ||
    (blob.includes("prisma.") && blob.includes("credit"))
  ) {
    return "PLATFORM_BILLING";
  }

  if (code === "BILLING_ERROR" || blob.includes("积分扣减失败")) {
    return "PLATFORM_BILLING";
  }

  if (isRateLimitFail(input)) {
    return "VENDOR_INPUT";
  }

  if (VENDOR_INPUT_FAIL_CODES.has(code)) {
    return "VENDOR_INPUT";
  }

  if (isContentPolicy(blob, msg) || isInvalidInput(blob, input.httpStatus ?? undefined)) {
    return "VENDOR_INPUT";
  }

  if (VENDOR_QUEUE_FAIL_CODES.has(code)) {
    return "VENDOR_QUEUE";
  }

  if (
    blob.includes("engineoverloaded") ||
    blob.includes("engine is currently overloaded")
  ) {
    return "VENDOR_INPUT";
  }

  if (code && code !== "FAILED" && code !== "REQUEST_FAILED") {
    return "VENDOR_QUEUE";
  }

  return "VENDOR_QUEUE";
}

/** 计费大类 → 驾驶舱健康矩阵模态（与产品约定：视频理解归多模态） */
export function billingCategoryToHealthModality(
  billingCategory: string | null | undefined,
  requestKind?: string | null,
): GenerationHealthModality {
  const cat = (billingCategory ?? "").trim();
  switch (cat) {
    case "TEXT_TO_IMAGE":
      return "IMAGE";
    case "IMAGE_TO_VIDEO":
    case "VIDEO_TO_VIDEO":
      return "VIDEO";
    case "VIDEO_UNDERSTANDING":
      return "MULTIMODAL";
    case "TTS":
      return "AUDIO";
    case "TEXT":
      return "TEXT";
    default:
      if ((requestKind ?? "").trim() === "CHAT") return "TEXT";
      if ((requestKind ?? "").trim() === "VIDEO") return "VIDEO";
      if ((requestKind ?? "").trim() === "IMAGE") return "IMAGE";
      return "TEXT";
  }
}