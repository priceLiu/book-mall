/** Gateway 日志 resultSummary 构建（Chat / 媒体） */

export function buildGatewayChatResultSummary(
  parsed: unknown,
): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const choice = Array.isArray(obj.choices)
    ? (obj.choices[0] as Record<string, unknown> | undefined)
    : undefined;
  const message =
    choice?.message && typeof choice.message === "object"
      ? (choice.message as Record<string, unknown>)
      : null;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) {
    return { kind: "chat", text: content.slice(0, 12000) };
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    const urls: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string") {
        parts.push(p.text);
      }
      const iu = p.image_url;
      if (
        iu &&
        typeof iu === "object" &&
        typeof (iu as { url?: string }).url === "string"
      ) {
        urls.push((iu as { url: string }).url);
      }
    }
    if (parts.length || urls.length) {
      return {
        kind: "chat",
        text: parts.join("\n").slice(0, 12000),
        ...(urls.length ? { imageUrls: urls } : {}),
      };
    }
  }
  return null;
}
