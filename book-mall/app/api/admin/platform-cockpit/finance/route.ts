import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { buildCockpitFinanceKpis } from "@/lib/admin/platform-cockpit-finance-kpis";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";

/** 驾驶舱 · 经营三角 KPI（可按账期刷新） */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewFinanceCost(session.user.role)) {
    return NextResponse.json({ error: "需要财务/超管权限" }, { status: 403 });
  }

  const periodKey = request.nextUrl.searchParams.get("periodKey") ?? undefined;
  const finance = await buildCockpitFinanceKpis({ periodKey });
  return NextResponse.json({ finance });
}
