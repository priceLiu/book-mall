/** 将服务端 failMessage 转为用户可读文案 */
export function formatCanvasTaskError(
  failCode?: string | null,
  failMessage?: string | null,
): string {
  const msg = (failMessage ?? "").trim();
  const code = (failCode ?? "").trim();
  const blob = `${code} ${msg}`.toLowerCase();

  if (
    blob.includes("429") ||
    blob.includes("frequency") ||
    blob.includes("rate limit") ||
    blob.includes("too many")
  ) {
    return "API 调用频率过高（429），请稍等 1～2 分钟后重试；批量任务会排队依次执行。";
  }
  if (
    blob.includes("kie_quota_exceeded") ||
    blob.includes("provider_quota_exceeded") ||
    blob.includes("code=402") ||
    blob.includes("余额不足") ||
    blob.includes("credits insufficient") ||
    blob.includes("insufficient credit") ||
    blob.includes("配额不足")
  ) {
    return "KIE 账户余额不足。请在 kie.ai 为 Gateway 绑定的 KIE API Key 充值后重试；分镜视频可改用百炼 Wan R2V、Seedance 等其它模型。";
  }
  if (blob.includes("kie chat empty content")) {
    return "KIE Gemini 返回空内容（可能被安全策略拦截或 reasoning 未输出正文）。请稍后重试，或换 deepseek-chat 等模型。";
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
