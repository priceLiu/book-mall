/** Gateway 日志 failCode / failMessage 展示（与 book-mall log-fail-code.ts 对齐） */

const CONTENT_POLICY_MARKERS = [
  "flagged as sensitive",
  "sensitive content",
  "content policy",
  "content filter",
  "moderation",
  "安全",
  "违规",
  "敏感",
] as const;

function inferFailCode(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): string | undefined {
  const existing = input.failCode?.trim();
  if (existing) return existing;

  const blob = (input.failMessage ?? "").toLowerCase();
  if (!blob) return undefined;

  if (CONTENT_POLICY_MARKERS.some((m) => blob.includes(m))) {
    return "CONTENT_POLICY";
  }
  if (blob.includes("insufficient") && blob.includes("credit")) {
    return "INSUFFICIENT_CREDITS";
  }
  if (
    blob.includes("recordinfo timeout") ||
    blob.includes("poll iteration") ||
    blob.includes("createtask retry timeout")
  ) {
    return "POLL_TRANSIENT";
  }
  if (blob.includes("timeout") || blob.includes("timed out")) {
    return "STALE_TIMEOUT";
  }
  return undefined;
}

export function resolveGatewayFailCodeDisplay(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): string {
  return inferFailCode(input) ?? "FAILED";
}

export function gatewayFailMessageDisplay(
  failMessage?: string | null,
): string {
  const raw = failMessage?.trim();
  if (!raw) {
    return "未记录详细原因（常见于上游空响应、连接中断或旧版日志）。请悬停查看 Params，或重试请求。";
  }
  const blob = raw.toLowerCase();
  if (CONTENT_POLICY_MARKERS.some((m) => blob.includes(m))) {
    return "内容被模型安全策略拦截。请修改提示词（减少敏感、暴力描述）后重试，或更换模型。";
  }
  return raw;
}
