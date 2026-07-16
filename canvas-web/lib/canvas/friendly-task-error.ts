/** 厂商 state 误写入 failCode/failMessage（如 success）· 非真实用户错误 */
export function isMislabeledVendorSuccessError(
  failCode?: string | null,
  failMessage?: string | null,
): boolean {
  const c = (failCode ?? "").trim().toLowerCase();
  const m = (failMessage ?? "").trim().toLowerCase();
  return (
    c === "success" ||
    c === "succeeded" ||
    c === "completed" ||
    m === "success" ||
    m === "succeeded" ||
    m === "completed" ||
    m === "status=success" ||
    m === "status=succeeded" ||
    m === "status=completed"
  );
}

/** Gateway 生图 modelKey（非 LLM chat） */
export function isGatewayImageModelKey(modelKey?: string | null): boolean {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return false;
  if (
    m.includes("nano-banana") ||
    m.startsWith("grok-imagine") ||
    m.startsWith("gpt-image") ||
    m.startsWith("seedream") ||
    m.startsWith("flux-") ||
    m.startsWith("kling/") ||
    m.includes("text-to-image") ||
    m.includes("image-to-image") ||
    m.includes("image-generation") ||
    m.includes("/edit") ||
    m === "qwen-text-to-image" ||
    m.includes("wanx") ||
    m.includes("wan2.")
  ) {
    return true;
  }
  return false;
}

type LlmVendorHint = "kie" | "deepseek" | "bailian" | "volcengine" | "unknown";

/** Gateway KIE 异步视频（Kling / Seedance / Grok video 等） */
export function isKieVideoModelKey(modelKey?: string | null): boolean {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return false;
  if (m.startsWith("kling") && (m.includes("video") || m.includes("motion-control"))) {
    return true;
  }
  if (m.startsWith("bytedance/seedance")) return true;
  if (m.startsWith("grok-imagine/") && m.includes("video")) return true;
  if (m.startsWith("happyhorse/")) return true;
  if (m === "wan/2-7-image-to-video") return true;
  return false;
}

/** 根据 modelKey 推断 LLM chat 厂商（Gateway 按 modelKey 路由，非 providerId） */
export function inferLlmVendorFromModelKey(
  modelKey?: string | null,
): LlmVendorHint {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return "unknown";
  if (isGatewayImageModelKey(m)) return "unknown";
  if (m.startsWith("deepseek")) return "deepseek";
  if (
    m.startsWith("google/") ||
    m.startsWith("gemini") ||
    m.startsWith("grok-imagine")
  ) {
    return "kie";
  }
  if (m.includes("qwen") || m.includes("bailian")) return "bailian";
  if (m.includes("doubao") || m.includes("seedance")) return "volcengine";
  return "unknown";
}

function insufficientBalanceMessage(modelKey?: string | null): string {
  if (isGatewayImageModelKey(modelKey)) {
    return "生图账户余额不足，请检查 Gateway 绑定的厂商凭证余额后重试。";
  }
  if (isKieVideoModelKey(modelKey)) {
    return "KIE 视频账户余额不足，请充值 Gateway 绑定的 KIE 凭证后重试。";
  }
  const vendor = inferLlmVendorFromModelKey(modelKey);
  switch (vendor) {
    case "deepseek":
      return "DeepSeek 账户余额不足，请充值 Gateway 绑定的凭证后重试。";
    case "bailian":
      return "百炼/通义账户余额不足，请充值 Gateway 绑定的凭证后重试。";
    case "kie":
      return "KIE 账户余额不足，请充值 Gateway 绑定的凭证后重试。";
    case "volcengine":
      return "火山方舟账户余额不足，请充值后重试，或改用其它模型。";
    default:
      return "模型账户余额不足，请检查 Gateway 绑定的厂商凭证余额。";
  }
}

function sanitizeGatewayTechnicalMessage(msg: string): string | null {
  const trimmed = msg.trim();
  if (!trimmed) return null;
  if (
    /gateway 内部链路|book-mall 自调用|baseurl|api\.kie\.ai|tls 握手|服务器出网|gemini/i.test(
      trimmed,
    )
  ) {
    return null;
  }
  if (trimmed.length > 120) {
    return `${trimmed.slice(0, 117)}…`;
  }
  return trimmed;
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
  "若为历史失败且账户已充值，请关闭错误提示后点「重新生成」。";

function networkFailureMessage(modelKey?: string | null): string {
  if (isGatewayImageModelKey(modelKey)) {
    return "生图服务暂时不可用，请稍后重试。";
  }
  if (isKieVideoModelKey(modelKey)) {
    return "KIE 视频服务暂时不可用，请稍后重试。";
  }
  const vendor = inferLlmVendorFromModelKey(modelKey);
  if (vendor === "kie") {
    return "文本模型服务暂时不可用，请稍后重试。";
  }
  if (vendor === "deepseek") {
    return "DeepSeek 服务暂时不可用，请稍后重试。";
  }
  if (vendor === "volcengine") {
    return "火山方舟服务暂时不可用（视觉理解通常需十余秒），请稍后重试。";
  }
  return "模型服务暂时不可用，请稍后重试。";
}

/** run API 抛错 / catch 块：从 HTTP 文案推断 failCode */
export function resolveLibtvRunFailureCode(rawMessage: string): string {
  const msg = rawMessage.trim();
  const blob = msg.toLowerCase();
  if (
    msg.includes("402") ||
    blob.includes("insufficient_credits") ||
    msg.includes("积分不足") ||
    msg.includes("积分不够")
  ) {
    return "INSUFFICIENT_CREDITS";
  }
  return "REQUEST_FAILED";
}

/** 将服务端 failMessage 转为用户可读文案；可选 modelKey 用于区分生图 / LLM */
export function formatCanvasTaskError(
  failCode?: string | null,
  failMessage?: string | null,
  modelKey?: string | null,
): string {
  const msg = extractVendorErrorMessage(failMessage ?? "");
  const code = (failCode ?? "").trim();
  const blob = `${code} ${msg} ${failMessage ?? ""}`.toLowerCase();

  if (isMislabeledVendorSuccessError(code, msg)) {
    return "视频已生成但未写入节点，请刷新画布或重新打开项目后重试。";
  }

  if (
    code === "SUBMIT_DISPATCH_TIMEOUT" ||
    code === "QUEUE_TIMEOUT" ||
    msg.includes("排队超过") ||
    msg.includes("提交生成超时")
  ) {
    return "提交生成超时，请重试";
  }

  if (
    blob.includes("429") ||
    blob.includes("frequency") ||
    blob.includes("rate limit") ||
    blob.includes("too many")
  ) {
    return "调用频率过高，请稍等 1～2 分钟后重试。";
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
      return "火山方舟账户欠费或余额不足，请充值后重试。";
    }
    return sanitizeGatewayTechnicalMessage(msg) ?? "火山方舟视频生成失败";
  }

  if (
    isMislabeledInsufficientCredits({ failCode: code, failMessage: msg }) ||
    (code === "SYSTEM_BUSY" && blob.includes("系统繁忙"))
  ) {
    return "系统繁忙，请稍后重试。";
  }

  if (blob.includes("积分不足")) {
    const base = msg.includes("积分不足")
      ? `${msg.split("。")[0]}。请前往主站充值后重试。`
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
    (blob.includes("credits insufficient") && blob.includes("kie")) ||
    (blob.includes("insufficient credit") && blob.includes("kie")) ||
    (blob.includes("余额不足") && blob.includes("kie"))
  ) {
    if (isGatewayImageModelKey(modelKey)) {
      return "KIE 生图账户余额不足，请充值后重试。";
    }
    if (isKieVideoModelKey(modelKey)) {
      return "KIE 视频账户余额不足，请充值后重试。";
    }
    return "KIE 账户余额不足，请充值后重试。";
  }

  if (
    blob.includes("product is not activated") ||
    blob.includes("not activated") && blob.includes("product")
  ) {
    const m = (modelKey ?? "").trim().toLowerCase();
    if (m.includes("kling")) {
      return "可灵（Kling）产品未开通或已停用。请在 KIE 控制台确认已激活对应生图/生视频产品，并在 Gateway 绑定有效凭证后重试。";
    }
    return "厂商产品未开通，请在对应控制台激活产品并检查 Gateway 凭证后重试。";
  }

  if (blob.includes("kie chat empty content")) {
    return "模型返回空内容，请稍后重试或更换模型。";
  }

  if (blob.includes("canvas_submit_incomplete")) {
    return inferLlmVendorFromModelKey(modelKey) === "volcengine"
      ? "火山方舟文本任务轮询异常（请重新生成；视觉理解通常需十余秒）。"
      : "任务提交异常，请重新生成。";
  }

  if (blob.includes("story_llm_stale") || blob.includes("story_llm_failed")) {
    if (inferLlmVendorFromModelKey(modelKey) === "volcengine") {
      return "火山方舟文本生成未完成，请重试。";
    }
  }

  if (
    blob.includes("transaction already closed") ||
    blob.includes("prisma.") ||
    blob.includes("transaction api error") ||
    blob.includes("connection pool") ||
    blob.includes("timed out fetching a new connection") ||
    blob.includes("server has closed the connection") ||
    blob.includes("can't reach database server") ||
    blob.includes("p1001") ||
    blob.includes("p1017") ||
    blob.includes("p2024")
  ) {
    if (process.env.NODE_ENV !== "production") {
      return "数据库连接失败（本地开发通常需 VPN 连接腾讯云 CDB）。请检查 VPN 与 book-mall/.env.local 的 DATABASE_URL，可用 pnpm --dir book-mall db:ping 自检。";
    }
    return "系统繁忙，任务已加入队列，请稍候勿重复点击。";
  }

  if (
    blob.includes("dimensions must be at least") ||
    blob.includes("300 pixels") ||
    (blob.includes("422") && blob.includes("image"))
  ) {
    return "参考图尺寸过小（需至少 300×300 像素）。请换更大参考图或重新生成图片后再试。";
  }

  if (
    blob.includes("flagged as sensitive") ||
    blob.includes("sensitive content") ||
    blob.includes("content policy") ||
    blob.includes("content filter") ||
    blob.includes("安全") ||
    blob.includes("违规")
  ) {
    return "内容被安全策略拦截，请修改提示词后重试。";
  }

  if (
    blob.includes("gateway 内部链路") ||
    blob.includes("api 连接超时") ||
    blob.includes("api 请求失败")
  ) {
    return networkFailureMessage(modelKey);
  }

  if (
    blob.includes("fetch failed") ||
    blob.includes("failed to fetch") ||
    blob.includes("network") ||
    blob.includes("aborterror") ||
    blob.includes("aborted") ||
    blob.includes("timeout") ||
    blob.includes("timed out")
  ) {
    return networkFailureMessage(modelKey);
  }

  const sanitized = sanitizeGatewayTechnicalMessage(msg);
  if (sanitized) return sanitized;
  if (code && code !== "FAILED" && code !== "REQUEST_FAILED") return code;
  return "生成失败，请稍后重试";
}
