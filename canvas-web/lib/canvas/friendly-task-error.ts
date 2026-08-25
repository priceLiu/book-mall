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
    m === "kling-3.0-image" ||
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

/** 画布 / 电商可灵 3.0 视频 · 阿里云百炼 DashScope */
export function isDashscopeKlingVideoModelKey(modelKey?: string | null): boolean {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return false;
  return (
    m === "kling-3.0/video" ||
    m === "kling-3.0" ||
    (m.startsWith("kling/kling-v3") &&
      m.includes("video") &&
      !m.includes("image"))
  );
}

/** KIE 仍可用的可灵 SKU（Turbo / Motion Control 等） */
export function isKieOnlyKlingVideoModelKey(modelKey?: string | null): boolean {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m.includes("kling")) return false;
  if (isDashscopeKlingImageModelKey(m)) return false;
  if (isDashscopeKlingVideoModelKey(m)) return false;
  return true;
}

/** 画布 / 电商可灵 3.0 生图 · 阿里云百炼 DashScope，不是 KIE */
export function isDashscopeKlingImageModelKey(modelKey?: string | null): boolean {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return false;
  return (
    m === "kling-3.0-image" ||
    (m.startsWith("kling/kling-v3") && m.includes("image"))
  );
}

/** Gateway KIE 异步视频（Seedance / Grok video 等；可灵 3.0 标准视频已迁百炼） */
export function isKieVideoModelKey(modelKey?: string | null): boolean {
  const m = (modelKey ?? "").trim().toLowerCase();
  if (!m) return false;
  if (isDashscopeKlingVideoModelKey(m)) return false;
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

function isContentSafetyRejection(blob: string): boolean {
  return (
    blob.includes("flagged as sensitive") ||
    blob.includes("sensitive content") ||
    blob.includes("content policy") ||
    blob.includes("content filter") ||
    blob.includes("appear to be unsafe") ||
    blob.includes("generated images appear") ||
    blob.includes("image may contain") ||
    blob.includes("inappropriate content") ||
    blob.includes("datainspectionfailed") ||
    blob.includes("green net") ||
    blob.includes("moderation") ||
    blob.includes("安全") ||
    blob.includes("违规")
  );
}

/** 百炼 DashScope 绿网 · 区分输入审核 vs 成片输出审核 */
function dashscopeGreenNetMessage(raw: string): string | null {
  const blob = raw.toLowerCase();
  if (
    !blob.includes("green net") &&
    !blob.includes("datainspectionfailed") &&
    !blob.includes("inappropriate content")
  ) {
    return null;
  }
  if (blob.includes("(output)") || blob.includes("output data")) {
    return "生成的视频未通过百炼内容安全审核（绿网）。请调整提示词、参考图或镜头/动作描述后重试；儿童角色类参考图偶发误拦，可换参考图或简化描述。";
  }
  if (
    blob.includes("(input)") ||
    blob.includes("image input") ||
    blob.includes("image (input)")
  ) {
    return "参考图或提示词未通过百炼内容安全审核（绿网）。请更换参考图或修改描述后重试。";
  }
  return "内容未通过百炼内容安全审核（绿网）。请修改提示词或参考图后重试。";
}

function contentSafetyRejectionMessage(raw?: string): string {
  return dashscopeGreenNetMessage(raw ?? "") ?? "内容被安全策略拦截，请修改提示词或参考图后重试。";
}

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
  if (
    msg.includes("503") ||
    blob.includes("database_unavailable") ||
    blob.includes("系统繁忙") ||
    blob.includes("book_mall_proxy_failed") ||
    blob.includes("主站鉴权暂时不可用") ||
    blob.includes("主站暂时不可达") ||
    blob.includes("connection pool") ||
    blob.includes("timed out fetching a new connection")
  ) {
    return "SYSTEM_BUSY";
  }
  if (
    msg.includes("401") ||
    blob.includes("unauthorized") ||
    msg.includes("缺少 Bearer Token") ||
    msg.includes("无效或过期的工具令牌") ||
    msg.includes("工具站登录令牌")
  ) {
    return "UNAUTHORIZED";
  }
  return "REQUEST_FAILED";
}

/** 将服务端 failMessage 转为用户可读文案；可选 modelKey 用于区分生图 / LLM */
export function formatCanvasTaskError(
  failCode?: string | null,
  failMessage?: string | null,
  modelKey?: string | null,
): string {
  const code = (failCode ?? "").trim();
  if (code === "USER_CANCELLED") {
    return "用户已中止生成";
  }
  const msg = extractVendorErrorMessage(failMessage ?? "");
  const blob = `${code} ${msg} ${failMessage ?? ""}`.toLowerCase();

  if (
    blob.includes("401") ||
    blob.includes("unauthorized") ||
    msg.includes("登录已失效") ||
    msg.includes("工具站登录令牌") ||
    msg.includes("重新连接主站账号")
  ) {
    return "登录状态已过期，请刷新页面或重新连接主站账号后再生成。";
  }

  if (isMislabeledVendorSuccessError(code, msg)) {
    return "视频已生成但未写入节点，请刷新画布或重新打开项目后重试。";
  }

  if (isContentSafetyRejection(blob)) {
    return contentSafetyRejectionMessage(msg || failMessage || "");
  }

  if (
    code === "SUBMIT_DISPATCH_TIMEOUT" ||
    code === "QUEUE_TIMEOUT" ||
    msg.includes("排队超过") ||
    msg.includes("提交生成超时")
  ) {
    return "提交生成超时，请重试";
  }

  // OSS 落库失败 ≠ 厂商生图失败；须先于 network/timeout 启发式，避免误报「生图服务不可用」
  if (
    code === "OSS_UPLOAD_FAILED" ||
    blob.includes("oss_upload_failed") ||
    blob.includes("persistkieresulttooss") ||
    (blob.includes("oss") &&
      (blob.includes("socket disconnected") ||
        blob.includes("secure tls") ||
        blob.includes("multipart")))
  ) {
    return "图片已生成，但保存到云存储失败。请重新生成；若多次失败请稍后重试。";
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
    blob.includes("engineoverloaded") ||
    blob.includes("engine is currently overloaded") ||
    code === "ENGINE_OVERLOADED"
  ) {
    return "文本模型引擎繁忙（厂商过载），请等待 1～2 分钟后重试，或暂时更换其它 LLM 模型。";
  }

  if (
    code === "INSUFFICIENT_CREDITS" ||
    blob.includes("insufficient_credits")
  ) {
    if (blob.includes("积分不足") || msg.includes("积分不足")) {
      const base = msg.includes("积分不足")
        ? `${msg.split("。")[0]}。请前往主站充值后重试。`
        : "平台积分不足，请充值后重试。";
      return `${base} ${STALE_INSUFFICIENT_HINT}`;
    }
    return `平台积分不足，请前往主站充值后重试。 ${STALE_INSUFFICIENT_HINT}`;
  }

  if (
    code === "PROVIDER_QUOTA_EXCEEDED" ||
    code === "KIE_QUOTA_EXCEEDED" ||
    blob.includes("provider_quota_exceeded")
  ) {
    if (isGatewayImageModelKey(modelKey)) {
      return "KIE 生图账户余额不足，请充值 Gateway 绑定的 KIE 凭证后重试。";
    }
    if (isKieVideoModelKey(modelKey)) {
      return "KIE 视频账户余额不足，请充值 Gateway 绑定的 KIE 凭证后重试。";
    }
    return "KIE 账户余额不足，请充值 Gateway 绑定的 KIE 凭证后重试。";
  }

  if (msg.includes("KIE 余额不足") || msg.includes("KIE 生图账户余额不足")) {
    return msg;
  }

  if (
    code === "IMAGE_ENGINE_FAILED" &&
    (blob.includes("insufficient") ||
      blob.includes("quota") ||
      blob.includes("balance") ||
      blob.includes("402") ||
      blob.includes("余额"))
  ) {
    return insufficientBalanceMessage(modelKey);
  }

  if (
    code === "IMAGE_ENGINE_FAILED" &&
    (blob.includes("invalid_input") ||
      blob.includes("缺少") ||
      blob.includes("prompt 为空") ||
      blob.includes("missing") ||
      blob.includes("422"))
  ) {
    return sanitizeGatewayTechnicalMessage(msg) ?? "生图参数无效，请检查参考图与模型配置后重试。";
  }

  if (code === "IMAGE_ENGINE_FAILED" && !blob.includes("gateway")) {
    const detail = sanitizeGatewayTechnicalMessage(msg);
    if (detail) return detail;
    return "生图提交失败（未到达 Gateway），请重试；若持续失败请查看 book-mall 任务记录。";
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

  if (isMislabeledInsufficientCredits({ failCode: code, failMessage: msg })) {
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
    (blob.includes("not activated") && blob.includes("product"))
  ) {
    const m = (modelKey ?? "").trim().toLowerCase();
    if (isDashscopeKlingImageModelKey(m)) {
      return "可灵 3.0 生图走阿里云百炼（DashScope），不是 KIE。请在百炼控制台开通可灵图像模型，并在 Gateway 绑定 DashScope / 百炼凭证后重试。";
    }
    if (isDashscopeKlingVideoModelKey(m)) {
      return "可灵 3.0 视频走阿里云百炼（DashScope），不是 KIE。请在百炼控制台开通可灵视频模型，并在 Gateway 绑定华北2 业务空间 DashScope 凭证（sk-ws-）后重试。";
    }
    if (isKieOnlyKlingVideoModelKey(m)) {
      return "可灵（Kling）视频产品未开通或已停用。请在 KIE 控制台确认已激活对应生视频产品，并在 Gateway 绑定有效凭证后重试。";
    }
    if (m.startsWith("kimi") || m.includes("kimi/")) {
      return "Kimi 模型走阿里云百炼代销，需在百炼控制台「模型广场」搜索 kimi/kimi-k3 并点击开通；须与 Gateway 平台代付绑定的 DashScope Key 为同一阿里云账号（华北2 北京）。开通后重试。";
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
      return "数据库连接失败。请检查 book-mall/.env.local 的 DATABASE_URL（公网连接池）、腾讯云白名单与 pnpm --dir book-mall db:ping。";
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
    code === "SYSTEM_BUSY" ||
    blob.includes("503") ||
    blob.includes("database_unavailable") ||
    blob.includes("book_mall_proxy_failed") ||
    blob.includes("主站鉴权暂时不可用") ||
    blob.includes("主站暂时不可达") ||
    blob.includes("econnrefused")
  ) {
    return "系统繁忙或主站连接异常，请稍后重试；若工具栏同时显示「保存失败」，请先确认 book-mall 与数据库连接正常。";
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
    (blob.includes("timeout") &&
      !blob.includes("connection pool") &&
      !blob.includes("timed out fetching a new connection")) ||
    (blob.includes("timed out") &&
      !blob.includes("connection pool") &&
      !blob.includes("timed out fetching a new connection"))
  ) {
    return networkFailureMessage(modelKey);
  }

  const sanitized = sanitizeGatewayTechnicalMessage(msg);
  if (sanitized) return sanitized;
  if (code && code !== "FAILED" && code !== "REQUEST_FAILED") return code;
  return "生成失败，请稍后重试";
}
