import type { FetchToolsSessionResult } from "@/lib/tools-introspect";

/** 工具站会话 inactive 时的细分原因（用于 UI 文案与是否静默换票） */
export type ToolsSessionInactiveReason =
  | "tools_access_denied"
  | "session_revoked"
  | "jwt_invalid"
  | "introspect_timeout"
  | "unknown";

export function parseToolsSessionInactiveReason(
  session: FetchToolsSessionResult,
): ToolsSessionInactiveReason | null {
  if (session.active) return null;

  const intro = session.introspect;
  if (intro && typeof intro === "object") {
    const reason = intro.reason;
    if (reason === "tools_access_denied") return "tools_access_denied";
    if (reason === "session_revoked") return "session_revoked";
    if (intro.session_source === "introspect_aborted") {
      return "introspect_timeout";
    }
  }

  if (session.introspectStatus === 401) return "jwt_invalid";
  return "unknown";
}

/** 仅令牌确实失效时清 Cookie；准入拒绝 / 主站超时勿清（避免换票死循环） */
export function shouldClearToolsTokenOnInactive(
  session: FetchToolsSessionResult,
): boolean {
  const reason = parseToolsSessionInactiveReason(session);
  return reason === "jwt_invalid" || reason === "session_revoked";
}

export function toolsSessionInactiveUserMessage(
  reason: ToolsSessionInactiveReason | null,
  opts?: { freshExchange?: boolean; hasCookie?: boolean },
): string {
  if (reason === "tools_access_denied") {
    return "当前账号未开通 AI 画布工具技术服务费。请先在主站个人中心「工具技术服务费」开通后再进入画布。";
  }
  if (reason === "session_revoked") {
    return "账号已在别处登录，请重新连接主站账号。";
  }
  if (reason === "introspect_timeout") {
    return "连接主站超时（常见于 book-mall 冷启动）。请点「重新连接」或确认 pnpm dev:all 已启动。";
  }
  if (reason === "jwt_invalid") {
    return opts?.freshExchange
      ? "刚完成 SSO 换票，但令牌校验失败。请点「去主站登录 / 换票」再试。"
      : "工具站令牌已失效，请重新连接主站账号。";
  }
  if (opts?.freshExchange && opts?.hasCookie) {
    return "刚完成 SSO 换票，主站校验较慢。请点「重新连接」或稍候再试。";
  }
  if (opts?.hasCookie) {
    return "工具站令牌已失效，请重新连接主站账号。";
  }
  return "尚未建立画布会话，请连接 Book 账号后继续使用。";
}
