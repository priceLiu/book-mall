import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { buildCockpitDailyDashboardCsv } from "@/lib/admin/platform-cockpit-daily-export";
import { buildCockpitDailyDashboard } from "@/lib/admin/platform-cockpit-daily-dashboard";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { cstBusinessDate, parseCstBusinessDateParam } from "@/lib/billing/cst-business-date";

/** 驾驶舱 · 当日数据看板（JSON / CSV 导出） */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewFinanceCost(session.user.role)) {
    return NextResponse.json({ error: "需要财务/超管权限" }, { status: 403 });
  }

  const rawDate = request.nextUrl.searchParams.get("date");
  const businessDateCst =
    parseCstBusinessDateParam(rawDate) ?? (rawDate ? null : cstBusinessDate());
  if (!businessDateCst) {
    return NextResponse.json({ error: "date 须为 YYYY-MM-DD（北京时间业务日）" }, { status: 400 });
  }

  const daily = await buildCockpitDailyDashboard({ businessDateCst });
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase() ?? "json";

  if (format === "csv") {
    const body = buildCockpitDailyDashboardCsv(daily);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cockpit-daily-${businessDateCst}.csv"`,
      },
    });
  }

  if (format !== "json") {
    return NextResponse.json({ error: "format 仅支持 json 或 csv" }, { status: 400 });
  }

  return NextResponse.json({ daily });
}
