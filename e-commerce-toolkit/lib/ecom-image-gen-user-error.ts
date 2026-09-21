/** 客户端：生图失败文案（与 book-mall formatEcomImageGenUserError 规则对齐） */
export function formatEcomImageGenUserMessage(raw: string): string {
  const blob = raw.trim().toLowerCase();
  if (!blob) return "生图失败，请稍后重试";

  if (
    blob.includes("filtered out") ||
    blob.includes("violated go") ||
    blob.includes("content policy") ||
    blob.includes("content filter") ||
    blob.includes("no images found in ai response") ||
    blob.includes("unable to show the generated image") ||
    blob.includes("敏感") ||
    blob.includes("违规") ||
    blob.includes("安全")
  ) {
    return "内容被模型安全策略拦截。请修改 Prompt、参考图或换用其它生图模型后重试（避免敏感、暴力、裸露等描述）。";
  }

  if (
    blob.includes("余额") ||
    blob.includes("insufficient credit") ||
    blob.includes("quota") ||
    blob.includes("arrearage") ||
    blob.includes("good standing") ||
    blob.includes("overdue-payment") ||
    blob.includes("accountoverdue")
  ) {
    return "厂商账户欠费或余额不足。请在 Gateway 控制台为对应厂商凭证充值后重试，或更换其它已绑定模型/凭证。";
  }

  if (blob.startsWith("{") && blob.includes("error")) {
    try {
      const parsed = JSON.parse(raw.trim()) as { error?: { message?: string; code?: string } };
      const msg = parsed.error?.message ?? "";
      const code = parsed.error?.code ?? "";
      if (code.toLowerCase() === "arrearage" || /good standing|overdue/i.test(msg)) {
        return "厂商账户欠费或余额不足。请在 Gateway 控制台为对应厂商凭证充值后重试，或更换其它已绑定模型/凭证。";
      }
      if (msg.trim()) return formatEcomImageGenUserMessage(msg);
    } catch {
      /* 非 JSON，沿用原文 */
    }
  }

  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}
