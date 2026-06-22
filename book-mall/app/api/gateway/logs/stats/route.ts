import { NextResponse, type NextRequest } from "next/server";

import {
  fetchDashboardCategoryStats,
  fetchDashboardChartStats,
  fetchDashboardFailCodeCounts,
  fetchDashboardModelStats,
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

    const needSummary = parts.has("summary");
    const needCategories = parts.has("categories");
    const needModels = parts.has("models");
    const needFailCodes = parts.has("failCodes");
    const needCharts = needCategories || needModels;

    if (needSummary && needCharts) {
      const [summary, charts] = await Promise.all([
        fetchDashboardStatsSummary(where),
        fetchDashboardChartStats(where),
      ]);
      payload.cards = summary.cards;
      if (needCategories) payload.byCategory = charts.byCategory;
      if (needModels) payload.byModel = charts.byModel;
    } else {
      if (needSummary) {
        const summary = await fetchDashboardStatsSummary(where);
        payload.cards = summary.cards;
      }
      if (needCategories && needModels) {
        const charts = await fetchDashboardChartStats(where);
        payload.byCategory = charts.byCategory;
        payload.byModel = charts.byModel;
      } else if (needCategories) {
        const categories = await fetchDashboardCategoryStats(where);
        payload.byCategory = categories.byCategory;
      } else if (needModels) {
        const models = await fetchDashboardModelStats(where);
        payload.byModel = models.byModel;
      }
    }

    if (needFailCodes) {
      const failStats = await fetchDashboardFailCodeCounts(where);
      payload.failCodes = failStats.failCodes;
      payload.failedTotal = failStats.failedTotal;
    }

    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof DashboardScopeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
