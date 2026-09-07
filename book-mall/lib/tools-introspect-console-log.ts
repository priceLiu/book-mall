import { toolsRouteDiagnosticsConsoleEnabled } from "@/lib/tools-route-diagnostics";

function roundMs(n: number): number {
  return Math.round(n * 10) / 10;
}

export type ToolsIntrospectConsolePhase =
  | "misconfigured"
  | "no_token"
  | "jwt_invalid"
  | "session_revoked"
  | "access_denied"
  | "ok";

export type ToolsIntrospectTimingBreakdown = {
  msJwtVerify?: number;
  msEligibility?: number;
  msNavKeys?: number;
  msServicePeriods?: number;
  msEcomNav?: number;
  msBilling?: number;
  msTenant?: number;
  msCredit?: number;
};

function formatBreakdown(payload: ToolsIntrospectTimingBreakdown): string {
  const parts: string[] = [];
  if (payload.msNavKeys != null) parts.push(`navKeys≈${roundMs(payload.msNavKeys)}ms`);
  if (payload.msServicePeriods != null) {
    parts.push(`servicePeriods≈${roundMs(payload.msServicePeriods)}ms`);
  }
  if (payload.msEcomNav != null) parts.push(`ecomNav≈${roundMs(payload.msEcomNav)}ms`);
  if (payload.msBilling != null) parts.push(`billing≈${roundMs(payload.msBilling)}ms`);
  if (payload.msTenant != null) parts.push(`tenant≈${roundMs(payload.msTenant)}ms`);
  if (payload.msCredit != null) parts.push(`credit≈${roundMs(payload.msCredit)}ms`);
  return parts.length ? ` · 扩展段 ${parts.join(" · ")}` : "";
}

function interpretIntrospect(payload: {
  phase: ToolsIntrospectConsolePhase;
  msJwtVerify?: number;
  msEligibility?: number;
  msTotal: number;
} & ToolsIntrospectTimingBreakdown): string {
  switch (payload.phase) {
    case "misconfigured":
      return "JWT 密钥未配置（requireToolsJwtSecret 失败）；检查 TOOLS_SSO_JWT_SECRET";
    case "no_token":
      return "缺少 Authorization Bearer；多为客户端误调或上游未转发令牌";
    case "jwt_invalid":
      return "工具 JWT 验签失败或已过期；请在工具站「重新连接」换票";
    case "session_revoked":
      return "账号已在其他设备登录，当前工具站会话已失效；请重新连接主站账号";
    case "access_denied":
      return `数据库已查到用户，但不满足工具站准入（非管理员且非黄金会员）；eligibility≈${payload.msEligibility != null ? `${roundMs(payload.msEligibility)}ms` : "?"}`;
    case "ok": {
      const db = payload.msEligibility != null ? roundMs(payload.msEligibility) : "?";
      const jwt = payload.msJwtVerify != null ? roundMs(payload.msJwtVerify) : "?";
      let hint = `JWT 验签≈${jwt}ms · DB准入(eligibility)≈${db}ms${formatBreakdown(payload)}`;
      if (typeof payload.msEligibility === "number" && payload.msEligibility > 500) {
        hint +=
          " · eligibility 偏高：多为数据库延迟/冷启动/复杂查询，可与迁库或优化 WalletEntry 计数一并考虑";
      }
      const postMs =
        (payload.msNavKeys ?? 0) +
        (payload.msServicePeriods ?? 0) +
        (payload.msEcomNav ?? 0) +
        (payload.msBilling ?? 0) +
        (payload.msTenant ?? 0) +
        (payload.msCredit ?? 0);
      if (postMs > 500) {
        hint += " · 扩展段合计偏高：多为 navKeys/租户/积分余额查询叠加或连接池排队";
      }
      return hint;
    }
  }
}

/** 服务端控制台一行摘要（开发环境或 TOOLS_DIAGNOSTICS=1）；不含令牌与用户标识 */
export function logToolsIntrospectToConsole(payload: {
  phase: ToolsIntrospectConsolePhase;
  msTotal: number;
} & ToolsIntrospectTimingBreakdown): void {
  if (!toolsRouteDiagnosticsConsoleEnabled()) return;

  const bits: string[] = [`phase=${payload.phase}`, `msTotal=${roundMs(payload.msTotal)}`];
  if (payload.msJwtVerify != null) bits.push(`msJwtVerify=${roundMs(payload.msJwtVerify)}`);
  if (payload.msEligibility != null) {
    bits.push(`msEligibility=${roundMs(payload.msEligibility)}`);
  }
  if (payload.msNavKeys != null) bits.push(`msNavKeys=${roundMs(payload.msNavKeys)}`);
  if (payload.msServicePeriods != null) {
    bits.push(`msServicePeriods=${roundMs(payload.msServicePeriods)}`);
  }
  if (payload.msEcomNav != null) bits.push(`msEcomNav=${roundMs(payload.msEcomNav)}`);
  if (payload.msBilling != null) bits.push(`msBilling=${roundMs(payload.msBilling)}`);
  if (payload.msTenant != null) bits.push(`msTenant=${roundMs(payload.msTenant)}`);
  if (payload.msCredit != null) bits.push(`msCredit=${roundMs(payload.msCredit)}`);

  const line = `[book-mall/api/sso/tools/introspect] ${bits.join(" · ")}`;
  const hint = `  └─ ${interpretIntrospect(payload)}`;
  console.info(`${line}\n${hint}`);
}
