/**
 * 工具站自有配置（大模型 Key、兼容网关等）。
 *
 * - **密钥只放在 `.env.local`**（或由宿主注入环境变量），勿提交仓库。
 * - 本模块仅从 `process.env` 读取，供服务端 Route Handler / Server Actions 使用；请勿传给客户端组件。
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

/** 文生图等能力是否具备最小配置（有 Key 即可在后端继续接线）。 */
export function isTextToImageBackendConfigured(): boolean {
  return Boolean(getOpenAiCompatApiKey());
}
