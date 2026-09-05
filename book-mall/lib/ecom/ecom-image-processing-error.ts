import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import {
  classifyGatewaySubmitError,
  isContentPolicySubmitMessage,
  isUpstreamBalanceMessage,
} from "@/lib/gateway/gateway-submit-error-policy";

const CONTENT_POLICY_USER_ZH =
  "内容被 Seedream/KIE 安全策略拦截。请修改场景描述、上下文案或参考图后重试（避免暴力、色情、辱骂等敏感表述）。";

/** 电商 AI 修图 / 表情包等 · 面向用户的错误文案（非 Gateway 原始英文） */
export function formatEcomImageProcessingUserError(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof GatewayRequiredError) {
    return { message: error.message, status: error.httpStatus };
  }

  const raw = error instanceof Error ? error.message.trim() : String(error).trim();

  if (isContentPolicySubmitMessage(raw)) {
    return { message: CONTENT_POLICY_USER_ZH, status: 400 };
  }

  if (isUpstreamBalanceMessage(raw)) {
    return {
      message:
        "厂商账户欠费或余额不足。请在 Gateway 控制台为对应凭证充值后重试，或更换其它已绑定模型/凭证。",
      status: 402,
    };
  }

  const classified = classifyGatewaySubmitError(error);

  if (classified.failCode === "CONTENT_POLICY") {
    return { message: CONTENT_POLICY_USER_ZH, status: 400 };
  }

  if (
    classified.userHintZh &&
    classified.failCode !== "UPSTREAM_SUBMIT_FAILED" &&
    classified.failCode !== "UNKNOWN"
  ) {
    const status =
      classified.failCode === "UPSTREAM_INSUFFICIENT_BALANCE"
        ? 402
        : classified.httpStatus && classified.httpStatus >= 400 && classified.httpStatus < 500
          ? classified.httpStatus
          : 500;
    return { message: classified.userHintZh, status };
  }

  if (raw.includes("余额") || raw.includes("Gateway Key 未绑定")) {
    return { message: raw, status: 402 };
  }

  if (raw.includes("Gateway")) {
    return { message: raw, status: 402 };
  }

  return { message: raw || "处理失败", status: 500 };
}
