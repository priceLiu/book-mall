import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { parseDashboardHoursParam } from "@/lib/gateway/log-query-params";
import { fetchGenerationHealthStats } from "@/lib/generation/generation-health-projection";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!canManagePricing(session.user.role)) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const hours = parseDashboardHoursParam(request.nextUrl.searchParams.get("hours")) ?? 24;
  const submittedFrom = new Date(Date.now() - hours * 3600 * 1000);

  const generationHealth = await fetchGenerationHealthStats({
    submittedAt: { gte: submittedFrom },
  });

  return NextResponse.json({ generationHealth, serverTime: new Date().toISOString() });
}