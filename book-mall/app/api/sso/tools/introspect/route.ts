import { NextResponse } from "next/server";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { logToolsIntrospectToConsole } from "@/lib/tools-introspect-console-log";
import { toolsRouteDiagnosticsEnabled } from "@/lib/tools-route-diagnostics";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";
import {
  getSessionVersion,
} from "@/lib/auth-session-version";
import { mergeEcomToolkitNavKeys } from "@/lib/ecom/ecom-access";
import { getUserEcomBillingMode } from "@/lib/ecom/ecom-billing-mode";
import { resolveToolsNavKeysForUser } from "@/lib/tool-subscription-entitlements";
import { getActiveToolServicePeriods } from "@/lib/tool-service-fee/periods";
import { resolveTenantContextForUser } from "@/lib/tenant/context";
import { getCreditBalance, getPoolBalances } from "@/lib/billing/credit-account-service";

export const dynamic = "force-dynamic";

function mergeDiag<T extends Record<string, unknown>>(
  body: T,
  diag: Record<string, unknown>,
): T & { _diag: Record<string, unknown> } {
  return { ...body, _diag: diag };
}

/**
 * 校验短时 JWT；工具站在敏感操作前可调用以复核准入（黄金会员或管理员，服务端携带 Bearer）。
 *
 * 观测：`Server-Timing`（jwt_verify / eligibility）；`TOOLS_DIAGNOSTICS=1` 时 JSON 含 `_diag`。
 * 控制台：`NODE_ENV=development` 或 `TOOLS_DIAGNOSTICS=1` 时打印摘要（不含令牌）。
 */
export async function GET(req: Request) {
  const tRoute = performance.now();

  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    logToolsIntrospectToConsole({
      phase: "misconfigured",
      msTotal: performance.now() - tRoute,
    });
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    logToolsIntrospectToConsole({
      phase: "no_token",
      msTotal: performance.now() - tRoute,
    });
    return NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 });
  }

  const tJwt0 = performance.now();
  const verified = verifyToolsAccessToken(raw, jwtSecret);
  const msJwtVerify = performance.now() - tJwt0;

  const diagEnabled = toolsRouteDiagnosticsEnabled();

  if (!verified) {
    logToolsIntrospectToConsole({
      phase: "jwt_invalid",
      msJwtVerify,
      msTotal: performance.now() - tRoute,
    });
    const headers = new Headers();
    headers.set(
      "Server-Timing",
      `jwt_verify;dur=${Math.round(msJwtVerify)}, route;dur=${Math.round(performance.now() - tRoute)}`,
    );
    headers.set("X-Tools-Introspect-Phase", "jwt_invalid");
    const body = diagEnabled
      ? mergeDiag({ active: false }, {
          msJwtVerify,
          msTotal: performance.now() - tRoute,
          phase: "jwt_invalid",
        })
      : { active: false };
    return NextResponse.json(body, { status: 401, headers });
  }

  if (verified.sv != null) {
    const current = await getSessionVersion(verified.sub);
    if (current !== verified.sv) {
      logToolsIntrospectToConsole({
        phase: "session_revoked",
        msJwtVerify,
        msTotal: performance.now() - tRoute,
      });
      const revokedHeaders = new Headers();
      revokedHeaders.set(
        "Server-Timing",
        `jwt_verify;dur=${Math.round(msJwtVerify)}, route;dur=${Math.round(performance.now() - tRoute)}`,
      );
      revokedHeaders.set("X-Tools-Introspect-Phase", "session_revoked");
      const payload = {
        active: false,
        reason: "session_revoked" as const,
        sub: verified.sub,
      };
      const body = diagEnabled
        ? mergeDiag(payload, {
            msJwtVerify,
            msTotal: performance.now() - tRoute,
            phase: "session_revoked",
            userId: verified.sub,
          })
        : payload;
      return NextResponse.json(body, { status: 401, headers: revokedHeaders });
    }
  }

  const tElig0 = performance.now();
  const elig = await getToolsSsoEligibility(verified.sub);
  const msEligibility = performance.now() - tElig0;

  const headers = new Headers();
  headers.set(
    "Server-Timing",
    `jwt_verify;dur=${Math.round(msJwtVerify)}, eligibility;dur=${Math.round(msEligibility)}, route;dur=${Math.round(performance.now() - tRoute)}`,
  );
  headers.set(
    "X-Tools-Introspect-Phase",
    elig.ok ? "ok" : "access_denied",
  );

  const baseDiag = {
    msJwtVerify,
    msEligibility,
    msTotal: performance.now() - tRoute,
    userId: verified.sub,
  };

  if (!elig.ok) {
    logToolsIntrospectToConsole({
      phase: "access_denied",
      msJwtVerify,
      msEligibility,
      msTotal: performance.now() - tRoute,
    });
    const payload = {
      active: false,
      reason: "tools_access_denied" as const,
      sub: verified.sub,
    };
    const body = diagEnabled ? mergeDiag(payload, { ...baseDiag, phase: "access_denied" }) : payload;
    return NextResponse.json(body, { headers });
  }

  logToolsIntrospectToConsole({
    phase: "ok",
    msJwtVerify,
    msEligibility,
    msTotal: performance.now() - tRoute,
  });

  const resolvedNav = await resolveToolsNavKeysForUser(verified.sub);
  const servicePeriods = elig.isAdmin
    ? []
    : (await getActiveToolServicePeriods(verified.sub)).map((p) => ({
        toolNavKey: p.toolNavKey,
        periodEnd: p.periodEnd.toISOString(),
        lastChargedPoints: p.lastChargedPoints,
      }));

  let tools_nav_keys = elig.isAdmin
    ? [...TOOL_SUITE_NAV_KEYS]
    : resolvedNav.keys;
  tools_nav_keys = await mergeEcomToolkitNavKeys(
    verified.sub,
    tools_nav_keys,
    elig.isAdmin,
  );

  const ecom_billing_mode =
    verified.ecom_billing_mode ?? (await getUserEcomBillingMode(verified.sub));

  // 多租户上下文 + 当前空间积分余额（团队取共享池，个人取个人账户）
  const tenantCtx = await resolveTenantContextForUser(
    verified.sub,
    verified.tenant_id ?? null,
  );
  let creditBalance: number | null = null;
  let creditPools: { general: number; video: number } | null = null;
  if (tenantCtx) {
    creditBalance = await getCreditBalance(tenantCtx.billingOwnerRef).catch(
      () => null,
    );
    const pools = await getPoolBalances(tenantCtx.billingOwnerRef).catch(
      () => null,
    );
    if (pools) {
      creditPools = {
        general: pools.general.balance,
        video: pools.video.balance,
      };
    }
  }

  const payload = {
    active: true,
    sub: verified.sub,
    tier: verified.tier,
    tools_role: elig.isAdmin ? ("admin" as const) : ("member" as const),
    exp: verified.exp,
    has_recharge_history: elig.gold.hasRechargeHistory,
    has_active_subscription: elig.hasActiveToolService,
    has_active_tool_service: elig.hasActiveToolService,
    has_course_subscription: elig.hasMembershipSubscription,
    tool_service_periods: servicePeriods,
    tools_nav_keys,
    ecom_billing_mode,
    tenant_id: tenantCtx?.tenantId ?? null,
    tenant_type: tenantCtx?.tenantType ?? null,
    role_type: tenantCtx?.role ?? null,
    seat_id: tenantCtx?.seatId ?? null,
    credit_balance: creditBalance,
    credit_pools: creditPools,
    email: elig.email,
    phone: elig.phone,
    name: elig.name,
    image: elig.image,
  };

  const body = diagEnabled ? mergeDiag(payload, { ...baseDiag, phase: "ok" }) : payload;
  return NextResponse.json(body, { headers });
}
