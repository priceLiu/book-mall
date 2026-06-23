import { NextResponse, type NextRequest } from "next/server";

import {
  fetchDashboardCategoryStats,
  fetchDashboardChartStats,
  fetchDashboardChartStatsMerged,
  fetchDashboardFailCodeCounts,
  fetchDashboardFailCodeCountsMerged,
  fetchDashboardModelStats,
  fetchDashboardStatsSummary,
  computeDashboardSummaryCardsMerged,
  parseDashboardStatsParts,
} from "@/lib/gateway/log-dashboard-projection";
import {
  buildDashboardLogWhere,
  dashboardLiveScopeKey,
  DashboardScopeError,
  isLiveDashboardQuery,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import { isGatewayLogHistoryMode } from "@/lib/gateway/gateway-hot-window";
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

    const historyMode = isGatewayLogHistoryMode(query.mode);
    // Gen-HotCold-R3：live 无过滤走投影；history 并读归档表。
    const summaryScopeKey =
      !historyMode && isLiveDashboardQuery(query)
        ? dashboardLiveScopeKey(user.id, query) ?? undefined
        : undefined;

    if (needSummary && needCharts) {
      if (historyMode) {
        const [cards, charts] = await Promise.all([
          computeDashboardSummaryCardsMerged(where),
          fetchDashboardChartStatsMerged(where),
        ]);
        payload.cards = cards;
        if (needCategories) payload.byCategory = charts.byCategory;
        if (needModels) payload.byModel = charts.byModel;
      } else {
        const [summary, charts] = await Promise.all([
          fetchDashboardStatsSummary(where, { scopeKey: summaryScopeKey }),
          fetchDashboardChartStats(where),
        ]);
        payload.cards = summary.cards;
        if (needCategories) payload.byCategory = charts.byCategory;
        if (needModels) payload.byModel = charts.byModel;
      }
    } else {
      if (needSummary) {
        if (historyMode) {
          payload.cards = await computeDashboardSummaryCardsMerged(where);
        } else {
          const summary = await fetchDashboardStatsSummary(where, {
            scopeKey: summaryScopeKey,
          });
          payload.cards = summary.cards;
        }
      }
      if (needCategories && needModels) {
        const charts = historyMode
          ? await fetchDashboardChartStatsMerged(where)
          : await fetchDashboardChartStats(where);
        payload.byCategory = charts.byCategory;
        payload.byModel = charts.byModel;
      } else if (needCategories) {
        const categories = historyMode
          ? (await fetchDashboardChartStatsMerged(where)).byCategory
          : (await fetchDashboardCategoryStats(where)).byCategory;
        payload.byCategory = categories;
      } else if (needModels) {
        const models = historyMode
          ? (await fetchDashboardChartStatsMerged(where)).byModel
          : (await fetchDashboardModelStats(where)).byModel;
        payload.byModel = models;
      }
    }

    if (needFailCodes) {
      const failStats = historyMode
        ? await fetchDashboardFailCodeCountsMerged(where)
        : await fetchDashboardFailCodeCounts(where);
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
