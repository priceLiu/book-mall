import {
  classifyGenerationUserFacingBucket,
  isMislabeledInsufficientCreditsLog,
  USER_MESSAGE_PLATFORM_BILLING,
  USER_MESSAGE_VENDOR_QUEUE,
  type ClassifyGenerationFailureInput,
} from "./taxonomy";

export const UPSTREAM_RATE_LIMIT_USER_ZH =
  "百炼/阿里云对该 API Key 的生图配额触发限流（通常为每分钟可提交次数 RPM 或短时 QPS 上限）。请约 1～2 分钟后重试；若经常 429，请在百炼控制台查看该模型的限流说明并升配额，或换用其它已绑定模型。";

const VENDOR_INPUT_HINTS: Record<string, string> = {
  CONTENT_POLICY:
    "内容被模型安全策略拦截。请修改提示词或参考素材后重试。",
  INVALID_INPUT: "请求参数不符合厂商要求（比例、参考图数量与格式等）。",
  MODEL_NOT_FOUND: "模型或接入点不存在，请检查 Gateway 模型登记与凭证。",
  UPSTREAM_AUTH_FAILED: "火山凭证无效或无权限，请检查 Gateway 凭证。",
  UPSTREAM_INSUFFICIENT_BALANCE:
    "厂商账户欠费或余额不足，请在对应厂商控制台充值或更换凭证。",
  UPSTREAM_FREE_QUOTA:
    "该模型的厂商免费额度已用完，请在控制台开通付费或换用其它模型。",
  UPSTREAM_RATE_LIMIT: UPSTREAM_RATE_LIMIT_USER_ZH,
  ENGINE_OVERLOADED:
    "文本模型引擎繁忙（厂商过载），请等待 1～2 分钟后重试，或暂时更换其它 LLM 模型。",
  OSS_UPLOAD_FAILED:
    "生成已完成，但保存到云存储失败，请重新生成或稍后重试。",
  SUBMIT_BURST_LIMIT:
    "提交过于频繁，请稍等片刻后分批重试。",
  MODEL_DAILY_LIMIT:
    "该模型今日平台调用已达上限，请明日再试或换用其它模型。",
};

/** 去掉 canvas BFF / fetch 层拼上的 `402 积分不足` / `402, 积分不足` 等前缀 */
export function stripLeadingHttpStatusPrefix(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const withComma = t.match(/^(\d{3})\s*[,，]\s*([\s\S]+)$/);
  if (withComma) {
    const status = Number(withComma[1]);
    if (status >= 400 && status < 600) return withComma[2].trim();
  }
  const withSpace = t.match(/^(\d{3})\s+([\s\S]+)$/);
  if (withSpace) {
    const status = Number(withSpace[1]);
    if (status >= 400 && status < 600) return withSpace[2].trim();
  }
  return t;
}

function trimCreditUserMessage(failMessage: string): string {
  const raw = stripLeadingHttpStatusPrefix(failMessage);
  if (!raw) return "积分不足，请前往主站充值后重试。";
  if (raw.includes("积分不足")) {
    const head = raw.split("。")[0];
    return head.includes("积分不足")
      ? `${head}。请前往主站充值后重试。`
      : "积分不足，请前往主站充值后重试。";
  }
  return raw;
}

export type FormatGenerationUserMessageInput = ClassifyGenerationFailureInput & {
  modelKey?: string | null;
};

/**
 * 用户可见文案（管理端仍读 failMessage 原文，不经此函数）。
 */
export function formatGenerationUserMessage(
  input: FormatGenerationUserMessageInput,
): string {
  const bucket = classifyGenerationUserFacingBucket(input);
  const code = input.failCode?.trim() ?? "";
  const msg = input.failMessage?.trim() ?? "";

  if (bucket === "USER_CREDITS") {
    if (isMislabeledInsufficientCreditsLog(input)) {
      return USER_MESSAGE_PLATFORM_BILLING;
    }
    return trimCreditUserMessage(msg);
  }

  if (bucket === "PLATFORM_BILLING") {
    return USER_MESSAGE_PLATFORM_BILLING;
  }

  if (bucket === "VENDOR_QUEUE") {
    return USER_MESSAGE_VENDOR_QUEUE;
  }

  const hint = VENDOR_INPUT_HINTS[code];
  if (hint) return hint;

  if (msg && msg.length <= 280 && !msg.includes("Prisma") && !msg.includes("prisma.")) {
    return msg;
  }

  return "请求不符合模型要求或厂商暂时不可用，请检查参数后重试。";
}