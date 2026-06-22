/**
 * Gateway 日志 failCode 推断与展示（与 gateway-submit-error-policy 对齐）。
 */
import {
  CONTENT_POLICY_MARKERS,
  isContentPolicySubmitMessage,
} from "@/lib/gateway/gateway-submit-error-policy";
import { isMislabeledInsufficientCreditsLog } from "@/lib/billing/billing-failure-map";

export { CONTENT_POLICY_MARKERS, isContentPolicySubmitMessage };

/** 展示 / 推断前纠正「积分不足误标 + Prisma 超时原文」。 */
export function reconcileGatewayFailCode(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): string | undefined {
  if (isMislabeledInsufficientCreditsLog(input)) {
    return "SYSTEM_BUSY";
  }
  const existing = input.failCode?.trim();
  if (existing) return existing;
  return inferGatewayFailCode(input);
}

/** 写入 GatewayRequestLog 前：failCode 为空时从 message / 上游 code 推断。 */
export function inferGatewayFailCode(input: {
  failCode?: string | null;
  failMessage?: string | null;
  upstreamCode?: string | null;
}): string | undefined {
  if (isMislabeledInsufficientCreditsLog(input)) {
    return "SYSTEM_BUSY";
  }
  const existing = input.failCode?.trim();
  if (existing) return existing;

  const upstream = input.upstreamCode?.trim();
  if (upstream) return upstream.slice(0, 64);

  const blob = (input.failMessage ?? "").toLowerCase();
  if (!blob) return undefined;

  if (isContentPolicySubmitMessage(input.failMessage)) {
    return "CONTENT_POLICY";
  }
  if (blob.includes("无厂商 taskid") || blob.includes("未成功提交（无厂商 taskid）")) {
    return "SUBMIT_ORPHAN";
  }
  if (
    blob.includes("prisma.") ||
    blob.includes("transaction already closed") ||
    blob.includes("interactive transaction timeout")
  ) {
    return "SYSTEM_BUSY";
  }
  if (
    blob.includes("积分不足") ||
    (blob.includes("insufficient") &&
      blob.includes("credit") &&
      !blob.includes("prisma") &&
      !blob.includes("creditledger"))
  ) {
    return "INSUFFICIENT_CREDITS";
  }
  if (
    blob.includes("recordinfo timeout") ||
    blob.includes("poll iteration") ||
    blob.includes("createTask retry timeout")
  ) {
    return "POLL_TRANSIENT";
  }
  if (blob.includes("timeout") || blob.includes("timed out")) {
    return "STALE_TIMEOUT";
  }
  return undefined;
}

/** UI 展示用：空 failCode 时与 inferGatewayFailCode 一致，否则 FAILED。 */
export function resolveGatewayFailCodeDisplay(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): string {
  return reconcileGatewayFailCode(input) ?? "FAILED";
}

export function isContentPolicyFailMessage(
  failMessage?: string | null,
): boolean {
  return isContentPolicySubmitMessage(failMessage);
}

/** 中文可读说明（仅 UI；存储仍以 failMessage 为准）。 */
export function gatewayFailMessageDisplay(
  failMessage?: string | null,
  failCode?: string | null,
): string {
  const raw = failMessage?.trim();
  if (
    isMislabeledInsufficientCreditsLog({ failCode, failMessage: raw }) ||
    (failCode?.trim() === "SYSTEM_BUSY" && raw)
  ) {
    return "系统繁忙，积分冻结超时，请稍后重试；若余额充足仍失败，请联系管理员。";
  }
  if (!raw) {
    return "未记录详细原因（常见于上游空响应、连接中断或旧版日志）。请悬停查看 Params，或重试请求。";
  }
  if (isContentPolicyFailMessage(raw)) {
    return "内容被模型安全策略拦截。请修改提示词（减少敏感、暴力描述）后重试，或更换模型。";
  }
  if (
    /transaction already closed|interactive transaction timeout|prisma\./i.test(raw) ||
    raw.includes("系统繁忙")
  ) {
    return "系统繁忙，积分扣减超时，请稍后重试；若余额充足仍失败，请联系管理员。";
  }
  if (raw.includes("积分不足")) {
    return raw;
  }
  return raw;
}
