import { InsufficientCreditsError } from "@/lib/billing/credit-account-service";
import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";
import {
  isPrismaTransactionTimeoutError,
  isRetryableTxError,
} from "@/lib/db-tx-retry";

/** Prisma 事务超时 / 连接池 / creditLedger 写失败 — 非真实余额不足。 */
export function isBillingDbBusyError(e: unknown): boolean {
  if (isPrismaConnectionUnavailable(e)) return true;
  if (isRetryableTxError(e)) return true;
  if (isPrismaTransactionTimeoutError(e)) return true;
  const msg = e instanceof Error ? e.message : e != null ? String(e) : "";
  if (!msg) return false;
  return /transaction already closed|interactive transaction timeout|transaction api error|creditledger\.create|timed out fetching a new connection|server has closed the connection|can't reach database server|pool timeout/i.test(
    msg,
  );
}

/** 历史日志：failCode=INSUFFICIENT_CREDITS 但 failMessage 实为 DB 繁忙。 */
export function isMislabeledInsufficientCreditsLog(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): boolean {
  if (input.failCode?.trim() !== "INSUFFICIENT_CREDITS") return false;
  return isBillingDbBusyError(input.failMessage ?? "");
}

export function mapBillingFailureForGatewayLog(e: unknown): {
  failCode: string;
  failMessage: string;
} {
  if (e instanceof InsufficientCreditsError) {
    return { failCode: "INSUFFICIENT_CREDITS", failMessage: e.message };
  }
  if (isBillingDbBusyError(e)) {
    return {
      failCode: "SYSTEM_BUSY",
      failMessage:
        "系统繁忙，积分冻结超时，请稍后重试；若余额充足仍失败，请联系管理员。",
    };
  }
  const raw = e instanceof Error ? e.message.trim() : String(e);
  return {
    failCode: "BILLING_ERROR",
    failMessage: raw || "积分扣减失败",
  };
}
