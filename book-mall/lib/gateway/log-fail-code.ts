/**
 * Gateway 日志 failCode 推断与展示（与 failMessage 对齐，不另建失败 taxonomy）。
 */

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

/** 写入 GatewayRequestLog 前：failCode 为空时从 message / 上游 code 推断。 */
export function inferGatewayFailCode(input: {
  failCode?: string | null;
  failMessage?: string | null;
  upstreamCode?: string | null;
}): string | undefined {
  const existing = input.failCode?.trim();
  if (existing) return existing;

  const upstream = input.upstreamCode?.trim();
  if (upstream) return upstream.slice(0, 64);

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
    blob.includes("createTask retry timeout")
  ) {
    return "POLL_TRANSIENT";
  }
  if (blob.includes("timeout") || blob.includes("timed out")) {
    return "STALE_TIMEOUT";
  }
  return undefined;
}

/** UI 展示用：空 failCode 时与 inferGatewayFailCode 一致，否则 FAILED。 */
export function resolveGatewayFailCodeDisplay(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): string {
  return inferGatewayFailCode(input) ?? "FAILED";
}

export function isContentPolicyFailMessage(
  failMessage?: string | null,
): boolean {
  const blob = (failMessage ?? "").toLowerCase();
  return CONTENT_POLICY_MARKERS.some((m) => blob.includes(m));
}

/** 中文可读说明（仅 UI；存储仍以 failMessage 为准）。 */
export function gatewayFailMessageDisplay(
  failMessage?: string | null,
): string {
  const raw = failMessage?.trim();
  if (!raw) {
    return "未记录详细原因（常见于上游空响应、连接中断或旧版日志）。请悬停查看 Params，或重试请求。";
  }
  if (isContentPolicyFailMessage(raw)) {
    return "内容被模型安全策略拦截。请修改提示词（减少敏感、暴力描述）后重试，或更换模型。";
  }
  return raw;
}
