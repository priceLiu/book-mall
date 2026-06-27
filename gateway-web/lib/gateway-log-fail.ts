/** Gateway 日志 failCode / failMessage 展示（与 book-mall log-fail-code.ts 对齐） */

const CONTENT_POLICY_MARKERS = [
  "flagged as sensitive",
  "sensitive information",
  "sensitive content",
  "content policy",
  "content filter",
  "moderation",
  "安全",
  "违规",
  "敏感",
] as const;

const FAIL_CODE_HINTS: Record<string, string> = {
  CONTENT_POLICY:
    "提示词或参考素材触发厂商内容安全策略，请改写后重试。",
  INVALID_INPUT: "请求参数不符合厂商要求（比例、参考图、content 结构等）。",
  MODEL_NOT_FOUND: "模型或接入点不存在，请检查 Gateway 登记与凭证。",
  UPSTREAM_AUTH_FAILED: "火山凭证无效或无权限。",
  UPSTREAM_INSUFFICIENT_BALANCE:
    "厂商账户欠费或余额不足（非凭证无效）。请到对应厂商控制台充值/结清欠费，或改用其它凭证/模型。",
  UPSTREAM_TRANSIENT: "厂商或网络瞬态错误；Gateway 已有限重试。",
  SUBMIT_ORPHAN:
    "已建 Gateway 日志但未拿到厂商 taskId（submit 挂起/进程中断），非内容安全 400。",
  UPSTREAM_SUBMIT_FAILED:
    "厂商在提交阶段拒绝或未知错误（未创建 taskId）。多为参数/配额/权限，请复制 Request ID 给厂商，而非 Vendor Task ID。",
  STALE_TIMEOUT:
    "Gateway 轮询超时后自动收口；厂商侧可能早已结束，请核对 Vendor Task ID。",
  VOLCENGINE_GATEWAY_POLL_STALL:
    "历史误杀（旧版停更收口）：厂商可能已出片，请点「厂商复核恢复」或到画布右下角加载。新任务 ≥10min 会转入持续后台生成，不再因此失败。",
  VOLCENGINE_QUEUED_STALE:
    "厂商 queued 阶段长时间无进展，Gateway 自动失败。",
  VOLCENGINE_POLL_LAG:
    "厂商已返回终态，Gateway 日志未及时 completed，请检查 poll worker。",
  STALE_ORPHAN:
    "请求未成功提交厂商（无 taskId），Gateway 自动关闭。",
  POLL_TRANSIENT: "轮询或提交 transient 超时，可重试。",
  SYSTEM_BUSY:
    "数据库或积分冻结事务繁忙/超时，非余额不足；请稍后重试。",
};

function isMislabeledInsufficientCredits(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): boolean {
  if (input.failCode?.trim() !== "INSUFFICIENT_CREDITS") return false;
  const blob = (input.failMessage ?? "").toLowerCase();
  return (
    blob.includes("prisma.") ||
    blob.includes("creditledger") ||
    blob.includes("transaction already closed") ||
    blob.includes("interactive transaction timeout") ||
    blob.includes("transaction api error") ||
    blob.includes("pool timeout") ||
    blob.includes("server has closed the connection")
  );
}

const UPSTREAM_BALANCE_MARKERS = [
  "overdue balance",
  "accountoverdue",
  "account overdue",
  "insufficient balance",
  "insufficient_balance",
  "arrears",
  "欠费",
  "余额不足",
] as const;

function inferFailCode(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): string | undefined {
  if (isMislabeledInsufficientCredits(input)) {
    return "SYSTEM_BUSY";
  }
  const blob = (input.failMessage ?? "").toLowerCase();
  // 欠费纠偏：历史误记为 UPSTREAM_AUTH_FAILED（凭证无效）的 403 欠费，按真因展示
  if (blob && UPSTREAM_BALANCE_MARKERS.some((m) => blob.includes(m))) {
    return "UPSTREAM_INSUFFICIENT_BALANCE";
  }
  const existing = input.failCode?.trim();
  if (existing) return existing;

  if (!blob) return undefined;

  if (CONTENT_POLICY_MARKERS.some((m) => blob.includes(m))) {
    return "CONTENT_POLICY";
  }
  if (blob.includes("无厂商 taskid") || blob.includes("未成功提交（无厂商 taskid）")) {
    return "SUBMIT_ORPHAN";
  }
  if (
    blob.includes("prisma.") ||
    blob.includes("transaction already closed") ||
    blob.includes("interactive transaction timeout")
  ) {
    return "SYSTEM_BUSY";
  }
  if (
    blob.includes("积分不足") ||
    (blob.includes("insufficient") &&
      blob.includes("credit") &&
      !blob.includes("prisma") &&
      !blob.includes("creditledger"))
  ) {
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

export function gatewayFailCodeHint(failCode?: string | null): string | null {
  const code = failCode?.trim();
  if (!code) return null;
  return FAIL_CODE_HINTS[code] ?? null;
}

export function gatewayFailMessageDisplay(
  failMessage?: string | null,
  failCode?: string | null,
): string {
  const raw = failMessage?.trim();
  const code = resolveGatewayFailCodeDisplay({ failCode, failMessage });
  const hint = gatewayFailCodeHint(code);

  if (isMislabeledInsufficientCredits({ failCode, failMessage: raw }) || code === "SYSTEM_BUSY") {
    return (
      hint ??
      "系统繁忙，积分冻结超时，请稍后重试；若余额充足仍失败，请联系管理员。"
    );
  }

  if (!raw) {
    const base =
      "未记录详细原因（常见于上游空响应、连接中断或旧版日志）。请查看 Params 或重试。";
    return hint ? `${base} ${hint}` : base;
  }

  const blob = raw.toLowerCase();
  if (CONTENT_POLICY_MARKERS.some((m) => blob.includes(m))) {
    return (
      hint ??
      "内容被模型安全策略拦截。请修改提示词（减少敏感、暴力描述）后重试，或更换模型。"
    );
  }

  if (hint && !raw.includes(hint.slice(0, 12))) {
    return `${raw} · ${hint}`;
  }
  return raw;
}

export function formatGatewayFailInline(input: {
  failCode?: string | null;
  failMessage?: string | null;
}): { code: string; message: string; title: string } {
  const code = resolveGatewayFailCodeDisplay(input);
  const message = gatewayFailMessageDisplay(input.failMessage, input.failCode);
  return {
    code,
    message,
    title: `failCode: ${code}\nfailMessage: ${message}`,
  };
}
