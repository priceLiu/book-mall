import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { buildUsageAuditForPeriod } from "@/lib/admin/platform-cockpit-usage-audit";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { normalizePeriod } from "@/lib/finance/reconciliation-v2/period-range";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewFinanceCost(session.user.role)) {
    return NextResponse.json({ error: "需要财务/超管权限" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";

  if (!from || !to) {
    return NextResponse.json({ error: "缺少 from / to（YYYY-MM-DD）" }, { status: 400 });
  }

  try {
    const period = normalizePeriod({ from, to });
    const data = await buildUsageAuditForPeriod(period);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
