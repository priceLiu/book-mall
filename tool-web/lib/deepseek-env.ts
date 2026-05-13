/** DeepSeek OpenAI 兼容 API（仅服务端读取）。见 doc/deepseek-api.md */

export function getDeepseekApiKey(): string | undefined {
  const v = process.env.DEEPSEEK_API_KEY?.trim();
  return v || undefined;
}
