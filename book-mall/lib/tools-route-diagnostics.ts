/** 工具 SSO 路由可选诊断：`TOOLS_DIAGNOSTICS=1` 时在 JSON 中附带 `_diag`（勿对公网长期开启）。 */
export function toolsRouteDiagnosticsEnabled(): boolean {
  return process.env.TOOLS_DIAGNOSTICS?.trim() === "1";
}

/** 开发环境或 `TOOLS_DIAGNOSTICS=1` 时在服务端控制台打印 introspect 摘要（不含令牌）。 */
export function toolsRouteDiagnosticsConsoleEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    toolsRouteDiagnosticsEnabled()
  );
}
