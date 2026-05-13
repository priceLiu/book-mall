import { NextResponse } from "next/server";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { logToolsIntrospectToConsole } from "@/lib/tools-introspect-console-log";
import { toolsRouteDiagnosticsEnabled } from "@/lib/tools-route-diagnostics";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

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

  const payload = {
    active: true,
    sub: verified.sub,
    tier: verified.tier,
    tools_role: elig.isAdmin ? ("admin" as const) : ("member" as const),
    exp: verified.exp,
    balance_minor: elig.gold.balanceMinor,
    min_balance_line_minor: elig.gold.minBalanceLineMinor,
    has_recharge_history: elig.gold.hasRechargeHistory,
    email: elig.email,
    name: elig.name,
    image: elig.image,
  };

  const body = diagEnabled ? mergeDiag(payload, { ...baseDiag, phase: "ok" }) : payload;
  return NextResponse.json(body, { headers });
}
