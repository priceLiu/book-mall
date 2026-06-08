/** 将 KIE / Gateway 任务 failMessage 转为用户可读文案 */
export function formatStoryTaskError(
  failCode?: string | null,
  failMessage?: string | null,
): string {
  const msg = (failMessage ?? "").trim();
  const code = (failCode ?? "").trim();
  const blob = `${code} ${msg}`.toLowerCase();

  if (
    blob.includes("kie_quota_exceeded") ||
    blob.includes("provider_quota_exceeded") ||
    blob.includes("code=402") ||
    blob.includes("402") ||
    blob.includes("credits insufficient") ||
    blob.includes("insufficient credit") ||
    blob.includes("余额不足") ||
    blob.includes("配额不足")
  ) {
    return "KIE 账户余额不足。请在 kie.ai 为当前 API Key 充值后重试，或在分镜视频设置里换用百炼 Wan R2V 等其它模型。";
  }
  if (
    blob.includes("429") ||
    blob.includes("rate limit") ||
    blob.includes("too many")
  ) {
    return "API 调用频率过高，请稍等 1～2 分钟后重试。";
  }
  if (blob.includes("kie_not_configured") || blob.includes("kie_api_key")) {
    return "服务端未配置 KIE，请联系管理员。";
  }
  if (msg) return msg;
  if (code) return code;
  return "生成失败，请稍后重试";
}
