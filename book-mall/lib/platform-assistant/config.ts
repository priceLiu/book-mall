/** 平台 AI 导览助手 · 运行时配置（模型 / 维度 / 检索参数）。 */

export const ASSISTANT_CHAT_MODEL =
  process.env.PLATFORM_ASSISTANT_CHAT_MODEL?.trim() || "deepseek-chat";

/** AI 热闻简报 · DeepSeek V4 */
export const ASSISTANT_NEWS_MODEL =
  process.env.PLATFORM_ASSISTANT_NEWS_MODEL?.trim() || "deepseek-v4-flash";

export const ASSISTANT_NEWS_MAX_TOKENS = 4096;

export const ASSISTANT_EMBED_MODEL =
  process.env.PLATFORM_ASSISTANT_EMBED_MODEL?.trim() || "text-embedding-v3";

export const ASSISTANT_EMBED_DIM = (() => {
  const raw = Number(process.env.PLATFORM_ASSISTANT_EMBED_DIM);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1024;
})();

/** 检索 top-k（提高召回，覆盖跨应用/总览类问题） */
export const ASSISTANT_TOP_K = 8;

/** 生成 max_tokens 上限 */
export const ASSISTANT_MAX_TOKENS = 1024;

/** 每用户限流：窗口内最大请求数 */
export const ASSISTANT_RATE_LIMIT = { windowMs: 60_000, max: 20 };

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
