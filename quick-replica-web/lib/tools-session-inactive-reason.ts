import type { FetchToolsSessionResult } from "@/lib/tools-introspect";

/** 工具站会话 inactive 时的细分原因（用于 UI 文案与是否清 Cookie） */
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

/** 仅令牌确实失效时清 Cookie；准入拒绝 / 主站超时勿清（避免误登出） */
export function shouldClearToolsTokenOnInactive(
  session: FetchToolsSessionResult,
): boolean {
  const reason = parseToolsSessionInactiveReason(session);
  return reason === "jwt_invalid" || reason === "session_revoked";
}
