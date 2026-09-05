/** 平台 AI 导览助手 · 运行时配置（检索参数 / 限流；模型见 DB 配置）。 */

export const ASSISTANT_NEWS_MAX_TOKENS = 4096;

/** 检索 top-k（提高召回，覆盖跨应用/总览类问题） */
export const ASSISTANT_TOP_K = 8;

/** 生成 max_tokens 上限 */
export const ASSISTANT_MAX_TOKENS = 1024;

/** 每用户限流：窗口内最大请求数 */
export const ASSISTANT_RATE_LIMIT = { windowMs: 60_000, max: 20 };

/** 匿名访客（按 IP）略严 */
export const ASSISTANT_GUEST_RATE_LIMIT = { windowMs: 60_000, max: 12 };

/**
 * 纯寒暄/无意义问候，跳过 embedding 检索以降低首字延迟。
 * 仅匹配整句极短问候，避免误伤「你好，平台有什么功能」这类实义问题。
 */
export function isPureGreeting(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!！。.~～\s]/g, "");
  if (!t) return true;
  if (t.length > 6) return false;
  return /^(你好|您好|hi|hello|hey|在吗|在么|哈喽|嗨|early|早上好|晚上好|下午好)$/.test(t);
}
