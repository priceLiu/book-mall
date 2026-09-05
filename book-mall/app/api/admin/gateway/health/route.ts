import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import {
  healGatewayHealth,
  readGatewayHealthHistory,
  scanGatewayHealth,
} from "@/lib/gateway/gateway-health-service";
import { getGatewayPublicOrigin } from "@/lib/gateway/env";

export const dynamic = "force-dynamic";

async function requireFinanceAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireFinanceAdmin();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const snapshot = await scanGatewayHealth({ source: "admin-get" });
  return NextResponse.json({
    snapshot,
    history: readGatewayHealthHistory(),
    gatewayOrigin: getGatewayPublicOrigin(),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireFinanceAdmin();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let action = "scan";
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action === "heal" || body.action === "scan") action = body.action;
  } catch {
    /* empty body = scan */
  }

  if (action === "heal") {
    const result = await healGatewayHealth({ source: "admin-heal" });
    return NextResponse.json({
      snapshot: result.after,
      before: result.before,
      heal: result.heal,
      history: readGatewayHealthHistory(),
      gatewayOrigin: getGatewayPublicOrigin(),
    });
  }

  const snapshot = await scanGatewayHealth({ source: "admin-scan" });
  return NextResponse.json({
    snapshot,
    history: readGatewayHealthHistory(),
    gatewayOrigin: getGatewayPublicOrigin(),
  });
}
