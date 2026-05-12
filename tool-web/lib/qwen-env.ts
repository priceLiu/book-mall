/**
 * 通义 DashScope API Key（文生图、图像类等）。
 * 优先 `QWEN_API_KEY`，未配置时回退 `DASHSCOPE_API_KEY`（与 AI 试衣 `try-on` 常用变量一致）。
 */
export function getQwenApiKey(): string | undefined {
  const explicit = process.env.QWEN_API_KEY?.trim();
  if (explicit) return explicit;
  const dash = process.env.DASHSCOPE_API_KEY?.trim();
  return dash || undefined;
}
