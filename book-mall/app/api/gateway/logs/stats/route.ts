import { NextResponse, type NextRequest } from "next/server";

import {
  fetchDashboardCategoryStats,
  fetchDashboardStatsSummary,
  parseDashboardStatsParts,
} from "@/lib/gateway/log-dashboard-projection";
import {
  buildDashboardLogWhere,
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);
  const parts = parseDashboardStatsParts(request.nextUrl.searchParams.get("parts"));

  try {
    const where = await buildDashboardLogWhere({
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
      query,
    });

    const payload: Record<string, unknown> = {
      serverTime: new Date().toISOString(),
    };

    if (parts.has("summary") && parts.has("categories")) {
      const [summary, categories] = await Promise.all([
        fetchDashboardStatsSummary(where),
        fetchDashboardCategoryStats(where),
      ]);
      payload.cards = summary.cards;
      payload.byCategory = categories.byCategory;
    } else if (parts.has("summary")) {
      const summary = await fetchDashboardStatsSummary(where);
      payload.cards = summary.cards;
    } else if (parts.has("categories")) {
      const categories = await fetchDashboardCategoryStats(where);
      payload.byCategory = categories.byCategory;
    }

    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof DashboardScopeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
