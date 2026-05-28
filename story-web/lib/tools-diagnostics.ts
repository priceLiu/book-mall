/** `/api/tools-session` 单次解析的诊断数据（供 Header / 可选 JSON `_diag`） */
export type ToolsSessionFetchDiag = {
  path:
    | "jwt_local"
    | "missing_main_origin"
    | "introspect_http"
    | "introspect_aborted"
    | "introspect_network_error";
  msTotal: number;
  msJwtAttempt?: number;
  msIntrospectFetch?: number;
  introspectHttpStatus?: number;
};

/** 无 Cookie / 空令牌时在 Route 层单独构造 */
export type ToolsSessionNoBearerDiag = {
  path: "no_bearer";
  msTotal: number;
};

/** 设为 `1` 时，`/api/tools-session` JSON 会附带 `_diag` 耗时字段（勿对公网长期开启）。 */
export function toolsDiagnosticsEnabled(): boolean {
  return process.env.TOOLS_DIAGNOSTICS?.trim() === "1";
}

/** 开发环境或 `TOOLS_DIAGNOSTICS=1` 时在服务端控制台打印会话解析摘要（不含令牌）。 */
export function toolsDiagnosticsConsoleEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.TOOLS_DIAGNOSTICS?.trim() === "1"
  );
}

export function toolsSessionServerTiming(
  diag: ToolsSessionFetchDiag | ToolsSessionNoBearerDiag,
): string {
  const parts: string[] = [`session;dur=${Math.round(diag.msTotal)};desc="tools-session-total"`];
  if ("msJwtAttempt" in diag && diag.msJwtAttempt != null) {
    parts.push(`jwt;dur=${Math.round(diag.msJwtAttempt)};desc="jwt-verify"`);
  }
  if ("msIntrospectFetch" in diag && diag.msIntrospectFetch != null) {
    parts.push(
      `introspect;dur=${Math.round(diag.msIntrospectFetch)};desc="main-introspect-fetch"`,
    );
  }
  return parts.join(", ");
}
