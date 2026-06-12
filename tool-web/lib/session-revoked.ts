export const SESSION_KICKED_MESSAGE =
  "您的账号已在其他设备或浏览器登录，当前会话已退出。请重新连接主站账号后继续使用。";

export function introspectSessionRevoked(
  introspect: Record<string, unknown> | null | undefined,
): boolean {
  return introspect?.reason === "session_revoked";
}
