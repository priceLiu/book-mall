/**
 * 工具站自有配置（OpenAI 兼容网关等）。
 *
 * 百炼 / DashScope 厂商调用统一经主站 Gateway（`forward-gateway-*-server`），
 * 不在 tool-web 配置 `DASHSCOPE_API_KEY`。
 *
 * 变量名模板见 `config/tool-web.env.example`。
 */

export function getOpenAiCompatApiKey(): string | undefined {
  const v = process.env.TOOL_WEB_OPENAI_COMPAT_API_KEY?.trim();
  return v || undefined;
}

/** OpenAI 兼容 Base URL，默认不传则用各家 SDK 的默认主机（按需自行封装调用）。 */
export function getOpenAiCompatBaseUrl(): string | undefined {
  const v = process.env.TOOL_WEB_OPENAI_COMPAT_BASE_URL?.trim();
  if (!v) return undefined;
  return v.replace(/\/$/, "");
}

export function getTextToImageModel(): string {
  return process.env.TOOL_WEB_IMAGE_MODEL?.trim() || "gpt-image-1";
}
