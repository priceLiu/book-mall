import type {
  ToolsSessionFetchDiag,
  ToolsSessionNoBearerDiag,
} from "@/lib/tools-diagnostics";
import { toolsDiagnosticsConsoleEnabled } from "@/lib/tools-diagnostics";
import type { FetchToolsSessionResult } from "@/lib/tools-introspect";

function roundMs(n: number): number {
  return Math.round(n * 10) / 10;
}

function interpretToolsSession(
  diag: ToolsSessionFetchDiag | ToolsSessionNoBearerDiag,
  session: FetchToolsSessionResult,
): string {
  switch (diag.path) {
    case "no_bearer":
      return "无 tools_token 或为空：浏览器未带会话 Cookie（或未 SSO）。↑ active=false 预期如此";
    case "jwt_local":
      return "JWT 本地验签成功，未请求主站；Neon/跨域不参与本条路径";
    case "missing_main_origin":
      return "MAIN_SITE_ORIGIN 未配置，无法回落 introspect；请补工具站环境变量";
    case "introspect_aborted":
      return "请求主站 introspect 超时（多为 DB 冷启动或网络）；对齐 JWT secret 可走 jwt_local 绕开 HTTP";
    case "introspect_network_error":
      return "连接主站失败（DNS/防火墙/主站未起）；检查 MAIN_SITE_ORIGIN 与主站是否可达";
    case "introspect_http": {
      const http = diag.introspectHttpStatus;
      const iMs =
        diag.msIntrospectFetch != null ? `${roundMs(diag.msIntrospectFetch)}ms` : "?";
      const jwtMs =
        diag.msJwtAttempt != null ? `${roundMs(diag.msJwtAttempt)}ms` : "—";
      if (session.active) {
        return `回落 HTTP introspect 成功；远端耗时≈${iMs}（本地 JWT 尝试≈${jwtMs}）。若总耗时秒级以上，多半在主站 DB / 网络；http=${http ?? "?"}`;
      }
      return `introspect 已返回但准入无效（令牌过期或 http≠200）；检查 JWT、会员门槛；http=${http ?? "?"} introspectStatus=${session.introspectStatus ?? "?"}`;
    }
  }
}

export function logToolsSessionDiagToConsole(
  session: FetchToolsSessionResult,
  diag: ToolsSessionFetchDiag | ToolsSessionNoBearerDiag,
): void {
  if (!toolsDiagnosticsConsoleEnabled()) return;

  const bits: string[] = [`path=${diag.path}`, `active=${session.active}`];
  bits.push(`msTotal=${roundMs(diag.msTotal)}`);
  if ("msJwtAttempt" in diag && diag.msJwtAttempt != null) {
    bits.push(`msJwt=${roundMs(diag.msJwtAttempt)}`);
  }
  if ("msIntrospectFetch" in diag && diag.msIntrospectFetch != null) {
    bits.push(`msIntrospect=${roundMs(diag.msIntrospectFetch)}`);
  }
  if ("introspectHttpStatus" in diag && diag.introspectHttpStatus != null) {
    bits.push(`introspectHttp=${diag.introspectHttpStatus}`);
  }

  const line = `[tool-web/api/tools-session] ${bits.join(" · ")}`;
  const hint = `  └─ ${interpretToolsSession(diag, session)}`;
  console.info(`${line}\n${hint}`);
}
