type LlmVendorHint = "kie" | "deepseek" | "bailian" | "volcengine" | "unknown";

/** 根据 modelKey 推断 LLM 实际调用的厂商（Gateway 按 modelKey 路由，非 providerId） */
export function inferLlmVendorFromModelKey(
  modelKey?: string | null,
): LlmVendorHint {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return "unknown";
  if (m.startsWith("deepseek")) return "deepseek";
  if (
    m.startsWith("google/") ||
    m.startsWith("gemini") ||
    m.includes("nano-banana") ||
    m.startsWith("grok-imagine")
  ) {
    return "kie";
  }
  if (m.includes("qwen") || m.includes("bailian")) return "bailian";
  if (m.includes("doubao") || m.includes("seedance")) return "volcengine";
  return "unknown";
}

function insufficientBalanceMessage(modelKey?: string | null): string {
  const vendor = inferLlmVendorFromModelKey(modelKey);
  const modelHint = modelKey?.trim() ? `（${modelKey.trim()}）` : "";
  switch (vendor) {
    case "deepseek":
      return `DeepSeek 账户余额不足${modelHint}。请在 platform.deepseek.com 为 Gateway 绑定的 DeepSeek API Key 充值后重试。`;
    case "bailian":
      return `百炼/通义账户余额不足${modelHint}。请在阿里云 DashScope 控制台为 Gateway 绑定的凭证充值后重试。`;
    case "kie":
      return `KIE 账户余额不足${modelHint}。请在 kie.ai 为 Gateway 绑定的 KIE API Key 充值后重试，或换用 DeepSeek 等非 KIE 模型。`;
    case "volcengine":
      return `火山方舟账户余额不足${modelHint}。请在火山引擎控制台充值后重试，或改用其它模型。`;
    default:
      return `模型账户余额不足${modelHint}。请检查 Gateway 绑定的对应厂商凭证余额，或换用其它模型。`;
  }
}

/** 从 Gateway / 厂商 JSON 错误体中提取 message */
function extractVendorErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const j = JSON.parse(trimmed) as {
      error?: string | { message?: string; code?: string };
      message?: string;
    };
    if (typeof j.error === "string") return j.error;
    if (j.error && typeof j.error === "object") {
      const nested = j.error.message?.trim();
      if (nested) return nested;
    }
    if (j.message?.trim()) return j.message.trim();
  } catch {
    /* keep raw */
  }
  return trimmed;
}

function isMislabeledInsufficientCredits(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): boolean {
  if (input.failCode?.trim() !== "INSUFFICIENT_CREDITS") return false;
  const blob = (input.failMessage ?? "").toLowerCase();
  return (
    blob.includes("prisma.") ||
    blob.includes("creditledger") ||
    blob.includes("transaction already closed") ||
    blob.includes("interactive transaction timeout") ||
    blob.includes("transaction api error") ||
    blob.includes("pool timeout") ||
    blob.includes("server has closed the connection")
  );
}

const STALE_INSUFFICIENT_HINT =
  "若为历史失败且账户已充值，请关闭节点上的错误提示后点「重新生成」。";

/** 将服务端 failMessage 转为用户可读文案；可选 modelKey 用于区分 DeepSeek / KIE 等同文案错误 */
export function formatCanvasTaskError(
  failCode?: string | null,
  failMessage?: string | null,
  modelKey?: string | null,
): string {
  const msg = extractVendorErrorMessage(failMessage ?? "");
  const code = (failCode ?? "").trim();
  const blob = `${code} ${msg} ${failMessage ?? ""}`.toLowerCase();

  if (
    blob.includes("429") ||
    blob.includes("frequency") ||
    blob.includes("rate limit") ||
    blob.includes("too many")
  ) {
    return "API 调用频率过高（429），请稍等 1～2 分钟后重试；批量任务会排队依次执行。";
  }

  if (
    blob.includes("overdue balance") ||
    blob.includes("火山方舟") ||
    blob.includes("doubao-seedance") ||
    blob.includes("volcengine")
  ) {
    if (
      blob.includes("overdue balance") ||
      blob.includes("403") ||
      blob.includes("欠费")
    ) {
      return "火山方舟账户欠费或余额不足。请在火山引擎控制台为 Gateway 绑定的凭证充值后重试，或改用其它视频模型。";
    }
    return msg || "火山方舟视频生成失败";
  }

  if (
    isMislabeledInsufficientCredits({ failCode: code, failMessage: msg }) ||
    (code === "SYSTEM_BUSY" && blob.includes("系统繁忙"))
  ) {
    return "系统繁忙，积分冻结超时，请稍后重试；若余额充足仍失败，请联系管理员。";
  }

  if (blob.includes("积分不足")) {
    const base = msg.includes("积分不足")
      ? `${msg}。请前往主站充值视频积分后重试。`
      : "平台积分不足，请充值后重试。";
    return `${base} ${STALE_INSUFFICIENT_HINT}`;
  }

  if (
    blob.includes("insufficient balance") ||
    (blob.includes("insufficient") && blob.includes("balance"))
  ) {
    return insufficientBalanceMessage(modelKey);
  }

  if (
    blob.includes("kie_quota_exceeded") ||
    code === "KIE_QUOTA_EXCEEDED" ||
    blob.includes("kie.ai") ||
    (blob.includes("code=402") && blob.includes("kie")) ||
    (blob.includes("credits insufficient") && blob.includes("kie")) ||
    (blob.includes("insufficient credit") && blob.includes("kie")) ||
    (blob.includes("余额不足") && blob.includes("kie"))
  ) {
    return "KIE 账户余额不足。请在 kie.ai 为 Gateway 绑定的 KIE API Key 充值后重试；分镜视频可改用百炼 Wan R2V、Seedance 等其它模型。";
  }

  if (blob.includes("kie chat empty content")) {
    return "KIE Gemini 返回空内容（可能被安全策略拦截或 reasoning 未输出正文）。请稍后重试，或换 deepseek-chat 等模型。";
  }

  if (
    blob.includes("transaction already closed") ||
    blob.includes("prisma.") ||
    blob.includes("transaction api error") ||
    blob.includes("connection pool") ||
    blob.includes("timed out fetching a new connection") ||
    blob.includes("server has closed the connection") ||
    blob.includes("can't reach database server")
  ) {
    return "系统繁忙，任务已加入队列或正在自动重试，请稍候勿重复点击。";
  }

  if (
    blob.includes("flagged as sensitive") ||
    blob.includes("sensitive content") ||
    blob.includes("content policy") ||
    blob.includes("content filter") ||
    blob.includes("安全") ||
    blob.includes("违规")
  ) {
    return "内容被模型安全策略拦截。请修改提示词（减少敏感描述）后重试，或更换模型。";
  }

  if (
    blob.includes("fetch failed") ||
    blob.includes("failed to fetch") ||
    blob.includes("network")
  ) {
    return "网络请求失败。若 Gateway 日志仍为 running，任务可能仍在生成，请稍候勿重复点击。";
  }
  if (msg) return msg;
  if (code) return code;
  return "生成失败";
}
