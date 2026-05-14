/** OpenAI 兼容模式百炼网关（视觉理解等），与 doc/ivo.md 一致。 */
export function getDashscopeOpenAiCompatBaseUrl(): string {
  const u = process.env.DASHSCOPE_OPENAI_COMPAT_BASE_URL?.trim();
  return u && u.length > 0 ? u : "https://dashscope.aliyuncs.com/compatible-mode/v1";
}
