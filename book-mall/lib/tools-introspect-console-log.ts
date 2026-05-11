import { toolsRouteDiagnosticsConsoleEnabled } from "@/lib/tools-route-diagnostics";

function roundMs(n: number): number {
  return Math.round(n * 10) / 10;
}

export type ToolsIntrospectConsolePhase =
  | "misconfigured"
  | "no_token"
  | "jwt_invalid"
  | "access_denied"
  | "ok";

function interpretIntrospect(payload: {
  phase: ToolsIntrospectConsolePhase;
  msJwtVerify?: number;
  msEligibility?: number;
  msTotal: number;
}): string {
  switch (payload.phase) {
    case "misconfigured":
      return "JWT 密钥未配置（requireToolsJwtSecret 失败）；检查 TOOLS_SSO_JWT_SECRET";
    case "no_token":
      return "缺少 Authorization Bearer；多为客户端误调或上游未转发令牌";
    case "jwt_invalid":
      return "工具 JWT 验签失败或已过期；请在工具站「重新连接」换票";
    case "access_denied":
      return `数据库已查到用户，但不满足工具站准入（非管理员且非黄金会员）；eligibility≈${payload.msEligibility != null ? `${roundMs(payload.msEligibility)}ms` : "?"}`;
    case "ok": {
      const db = payload.msEligibility != null ? roundMs(payload.msEligibility) : "?";
      const jwt = payload.msJwtVerify != null ? roundMs(payload.msJwtVerify) : "?";
      let hint = `JWT 验签≈${jwt}ms · DB准入(eligibility)≈${db}ms`;
      if (typeof payload.msEligibility === "number" && payload.msEligibility > 500) {
        hint +=
          " · eligibility 偏高：多为数据库延迟/冷启动/复杂查询，可与迁库或优化 WalletEntry 计数一并考虑";
      }
      return hint;
    }
  }
}

/** 服务端控制台一行摘要（开发环境或 TOOLS_DIAGNOSTICS=1）；不含令牌与用户标识 */
export function logToolsIntrospectToConsole(payload: {
  phase: ToolsIntrospectConsolePhase;
  msJwtVerify?: number;
  msEligibility?: number;
  msTotal: number;
}): void {
  if (!toolsRouteDiagnosticsConsoleEnabled()) return;

  const bits: string[] = [`phase=${payload.phase}`, `msTotal=${roundMs(payload.msTotal)}`];
  if (payload.msJwtVerify != null) bits.push(`msJwtVerify=${roundMs(payload.msJwtVerify)}`);
  if (payload.msEligibility != null) {
    bits.push(`msEligibility=${roundMs(payload.msEligibility)}`);
  }

  const line = `[book-mall/api/sso/tools/introspect] ${bits.join(" · ")}`;
  const hint = `  └─ ${interpretIntrospect(payload)}`;
  console.info(`${line}\n${hint}`);
}
