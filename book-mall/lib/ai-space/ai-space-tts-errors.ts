/** 口播 TTS 上游错误 → 用户可读文案（禁止只抛原始 JSON） */

export function formatAiSpaceTtsUpstreamError(raw: string): string {
  const text = raw.trim();
  if (!text) return "语音合成失败，请稍后重试";

  try {
    const parsed = JSON.parse(text) as {
      code?: string;
      message?: string;
      error?: string | { message?: string; code?: string };
    };

    const code =
      parsed.code ??
      (typeof parsed.error === "object" ? parsed.error?.code : undefined) ??
      "";
    const message =
      parsed.message ??
      (typeof parsed.error === "object"
        ? parsed.error?.message
        : typeof parsed.error === "string"
          ? parsed.error
          : undefined) ??
      "";

    if (code === "Arrearage" || /arrearage|overdue|good standing/i.test(message)) {
      return "百炼（阿里云）账号欠费或已停用，请在阿里云百炼控制台检查账户与余额后再试；克隆音色请切换为 MiniMax 模型。";
    }
    if (message) return message;
  } catch {
    /* 非 JSON */
  }

  if (/Arrearage|overdue payment|good standing/i.test(text)) {
    return "百炼（阿里云）账号欠费或已停用，请在阿里云百炼控制台检查账户与余额后再试。";
  }

  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}
