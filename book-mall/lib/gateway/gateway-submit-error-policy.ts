/**
 * Gateway 异步任务 · 厂商 submit 错误分类、重试策略、failCode 写入。
 * Canvas / Story / 电商 / createTask 共用，避免各项目重复实现。
 */
import { VolcengineUpstreamError } from "@/lib/gateway/volcengine-client";

export const CONTENT_POLICY_MARKERS = [
  "flagged as sensitive",
  "sensitive information",
  "sensitive content",
  "content policy",
  "content filter",
  "moderation",
  "安全",
  "违规",
  "敏感",
] as const;

export const INVALID_INPUT_MARKERS = [
  "invalid",
  "validation",
  "malformed",
  "bad request",
  "参数",
  "格式",
] as const;

export const MODEL_NOT_FOUND_MARKERS = [
  "model not found",
  "model_not_found",
  "unknown model",
  "does not exist",
  "not exist",
  "模型不存在",
  "endpoint not found",
] as const;

export const TRANSIENT_SUBMIT_MARKERS = [
  "econnreset",
  "econnrefused",
  "etimedout",
  "network",
  "socket hang up",
  "fetch failed",
  "temporarily unavailable",
  "service unavailable",
  "gateway timeout",
  "recordinfo timeout",
  "createTask retry timeout",
] as const;

/** 瞬态 submit 重试：仅 TRANSIENT，指数退避，不阻塞 90s */
export const GATEWAY_SUBMIT_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
export const GATEWAY_SUBMIT_MAX_TRANSIENT_ATTEMPTS = 3;

export type GatewaySubmitErrorClass = "NON_RETRYABLE" | "TRANSIENT" | "UNKNOWN";

export type ClassifiedGatewaySubmitError = {
  class: GatewaySubmitErrorClass;
  failCode: string;
  message: string;
  httpStatus?: number;
  vendorRequestId?: string;
  vendorTaskId?: string;
  retryable: boolean;
  userHintZh: string;
};

function normalizeBlob(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isContentPolicySubmitMessage(message?: string | null): boolean {
  const blob = normalizeBlob(message ?? "");
  if (!blob) return false;
  return CONTENT_POLICY_MARKERS.some((m) => blob.includes(m));
}

function isInvalidInputMessage(message: string, httpStatus?: number): boolean {
  if (httpStatus === 400 && !isContentPolicySubmitMessage(message)) {
    if (MODEL_NOT_FOUND_MARKERS.some((m) => message.includes(m))) return false;
    return true;
  }
  const blob = normalizeBlob(message);
  return INVALID_INPUT_MARKERS.some((m) => blob.includes(m));
}

function isModelNotFoundMessage(message: string, httpStatus?: number): boolean {
  if (httpStatus === 404) return true;
  const blob = normalizeBlob(message);
  return MODEL_NOT_FOUND_MARKERS.some((m) => blob.includes(m));
}

function isTransientSubmitMessage(message: string, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  if (httpStatus != null && httpStatus >= 500) return true;
  const blob = normalizeBlob(message);
  return TRANSIENT_SUBMIT_MARKERS.some((m) => blob.includes(m));
}

function extractVendorRequestId(message: string): string | undefined {
  return message.match(/Request id:\s*([^\s]+)/i)?.[1]?.trim();
}

/** 火山业务错误码，如 [错误码：40003] */
export function extractVolcengineVendorErrorCode(
  message?: string | null,
): string | undefined {
  const raw = message?.trim();
  if (!raw) return undefined;
  const patterns = [
    /\[错误码[：:\s]*(\d+)\]/i,
    /错误码[：:\s]*(\d+)/i,
    /error[_\s]?code[：:\s]*['"]?(\w+)['"]?/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function classifyGatewaySubmitError(error: unknown): ClassifiedGatewaySubmitError {
  if (error instanceof VolcengineUpstreamError) {
    const message = error.message;
    const httpStatus = error.status;
    const vendorRequestId = error.requestId ?? extractVendorRequestId(message);
    const vendorTaskId = error.vendorTaskId;

    if (isContentPolicySubmitMessage(message)) {
      return {
        class: "NON_RETRYABLE",
        failCode: "CONTENT_POLICY",
        message,
        httpStatus,
        vendorRequestId,
        vendorTaskId,
        retryable: false,
        userHintZh: "提示词或参考素材触发厂商内容安全，请修改后重试。",
      };
    }
    if (isModelNotFoundMessage(message, httpStatus)) {
      return {
        class: "NON_RETRYABLE",
        failCode: "MODEL_NOT_FOUND",
        message,
        httpStatus,
        vendorRequestId,
        vendorTaskId,
        retryable: false,
        userHintZh: "模型或接入点不存在，请检查 Gateway 模型登记与凭证。",
      };
    }
    const vendorBizCode = extractVolcengineVendorErrorCode(message);
    if (
      vendorBizCode &&
      !isContentPolicySubmitMessage(message) &&
      (httpStatus === 400 ||
        httpStatus === 422 ||
        isInvalidInputMessage(message, httpStatus))
    ) {
      return {
        class: "NON_RETRYABLE",
        failCode: "INVALID_INPUT",
        message,
        httpStatus,
        vendorRequestId,
        vendorTaskId,
        retryable: false,
        userHintZh: `厂商业务错误码 ${vendorBizCode}：多为参数/配额/模型权限，非用户选错模型本身。请复制 Request ID 给厂商排查。`,
      };
    }
    if (isInvalidInputMessage(message, httpStatus)) {
      return {
        class: "NON_RETRYABLE",
        failCode: "INVALID_INPUT",
        message,
        httpStatus,
        vendorRequestId,
        vendorTaskId,
        retryable: false,
        userHintZh: "请求参数不符合厂商要求，请检查比例、参考图数量与 content 结构。",
      };
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return {
        class: "NON_RETRYABLE",
        failCode: "UPSTREAM_AUTH_FAILED",
        message,
        httpStatus,
        vendorRequestId,
        vendorTaskId,
        retryable: false,
        userHintZh: "火山凭证无效或无权限，请检查 Gateway 凭证与 baseUrl。",
      };
    }
    if (isTransientSubmitMessage(message, httpStatus)) {
      return {
        class: "TRANSIENT",
        failCode: "UPSTREAM_TRANSIENT",
        message,
        httpStatus,
        vendorRequestId,
        vendorTaskId,
        retryable: true,
        userHintZh: "厂商或网络瞬态错误，Gateway 已按策略有限重试。",
      };
    }
    return {
      class: "UNKNOWN",
      failCode: "UPSTREAM_SUBMIT_FAILED",
      message,
      httpStatus,
      vendorRequestId,
      vendorTaskId,
      retryable: false,
      userHintZh: "厂商提交失败，请查看 failMessage 与 Request ID。",
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const vendorRequestId = extractVendorRequestId(message);

  if (message.includes("凭证不可用") || message.includes("credential")) {
    return {
      class: "NON_RETRYABLE",
      failCode: "CREDENTIAL_MISSING",
      message,
      vendorRequestId,
      retryable: false,
      userHintZh: "Gateway 凭证不可用或未绑定。",
    };
  }
  if (isTransientSubmitMessage(message)) {
    return {
      class: "TRANSIENT",
      failCode: "UPSTREAM_TRANSIENT",
      message,
      vendorRequestId,
      retryable: true,
      userHintZh: "网络或上游瞬态错误，Gateway 已按策略有限重试。",
    };
  }
  return {
    class: "UNKNOWN",
    failCode: "UPSTREAM_SUBMIT_FAILED",
    message,
    vendorRequestId,
    retryable: false,
    userHintZh: "提交失败，请查看 failMessage。",
  };
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 仅对 TRANSIENT 错误退避重试；NON_RETRYABLE 立即抛出。 */
export async function runGatewaySubmitWithRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    maxTransientAttempts?: number;
    delaysMs?: readonly number[];
  },
): Promise<T> {
  const maxAttempts = opts?.maxTransientAttempts ?? GATEWAY_SUBMIT_MAX_TRANSIENT_ATTEMPTS;
  const delays = opts?.delaysMs ?? GATEWAY_SUBMIT_RETRY_DELAYS_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const classified = classifyGatewaySubmitError(e);
      if (!classified.retryable || attempt >= maxAttempts - 1) {
        throw e;
      }
      await sleepMs(delays[attempt] ?? delays[delays.length - 1] ?? 2_000);
    }
  }

  throw lastError;
}

export type FinalizeSubmitFailureInput = {
  logId: string;
  error: unknown;
  durationMs?: number;
  externalTaskId?: string | null;
};

/** 将 classify 结果写入 GatewayRequestLog（submit 失败统一入口） */
export async function buildSubmitFailureFinalizePayload(
  error: unknown,
  opts?: { durationMs?: number; externalTaskId?: string | null },
): Promise<{
  status: "FAILED";
  durationMs: number;
  failMessage: string;
  failCode: string;
  vendorRequestId?: string;
  externalTaskId?: string;
}> {
  const classified = classifyGatewaySubmitError(error);
  const hint =
    classified.userHintZh && !classified.message.includes(classified.userHintZh.slice(0, 8))
      ? `${classified.message} · ${classified.userHintZh}`
      : classified.message;
  return {
    status: "FAILED",
    durationMs: opts?.durationMs ?? 0,
    failMessage: hint.slice(0, 500),
    failCode: classified.failCode,
    ...(classified.vendorRequestId ? { vendorRequestId: classified.vendorRequestId } : {}),
    ...(opts?.externalTaskId?.trim()
      ? { externalTaskId: opts.externalTaskId.trim() }
      : classified.vendorTaskId
        ? { externalTaskId: classified.vendorTaskId }
        : {}),
  };
}

/** 无 externalTaskId 且 RUNNING 超时 — 与厂商 HTTP 400 拒绝区分 */
export const SUBMIT_ORPHAN_FAIL = {
  failCode: "SUBMIT_ORPHAN",
  failMessage:
    "火山视频任务未成功提交（无厂商 taskId）。常见：submit HTTP 挂起、进程中断、或 finalize 未写入；非厂商内容安全 400。",
  userHintZh: "提交未拿到 taskId，请查 Gateway 日志 Params 与当时连接/进程状态。",
} as const;
