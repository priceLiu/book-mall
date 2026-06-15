import { NextResponse, type NextRequest } from "next/server";
import { buildGatewayLogWhere } from "@/lib/gateway/log-query-scope";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const days = Math.min(
    90,
    Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? "30")),
  );
  const since = new Date(Date.now() - days * 86400000);

  const where = await buildGatewayLogWhere(
    {
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
    },
    { submittedFrom: since },
  );

  const logs = await prisma.gatewayRequestLog.findMany({
    where,
    select: {
      model: true,
      status: true,
      totalTokens: true,
      hasTokenUsage: true,
      durationMs: true,
      estimatedVendorCostYuan: true,
      submittedAt: true,
    },
  });

  let totalRequests = logs.length;
  let totalTokens = 0;
  let totalCost = 0;
  const byModel = new Map<
    string,
    { count: number; tokens: number; cost: number }
  >();
  const byDay = new Map<string, { requests: number; tokens: number }>();

  for (const l of logs) {
    if (l.totalTokens) totalTokens += l.totalTokens;
    const cost = l.estimatedVendorCostYuan?.toNumber?.() ?? Number(l.estimatedVendorCostYuan ?? 0);
    totalCost += cost;
    const m = byModel.get(l.model) ?? { count: 0, tokens: 0, cost: 0 };
    m.count++;
    m.tokens += l.totalTokens ?? 0;
    m.cost += cost;
    byModel.set(l.model, m);
    const day = l.submittedAt.toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { requests: 0, tokens: 0 };
    d.requests++;
    d.tokens += l.totalTokens ?? 0;
    byDay.set(day, d);
  }

  const topModels = [...byModel.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([model, v]) => ({ model, ...v }));

  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({
    summary: { totalRequests, totalTokens, totalCostYuan: totalCost, days },
    topModels,
    daily,
  });
}
