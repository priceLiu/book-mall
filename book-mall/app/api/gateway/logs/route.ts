import { NextResponse, type NextRequest } from "next/server";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import {
  computeLogTotalPages,
  parseLogLimitParam,
  parseLogPageParam,
} from "@/lib/gateway/log-query-params";
import { resolveGatewayLogListFacets } from "@/lib/gateway/log-list-facets";
import {
  buildDashboardLogWhere,
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import {
  gatewayDatabaseUnavailableResponse,
  isGatewayDatabaseError,
} from "@/lib/gateway/gateway-route-errors";
import { mapGatewayRequestLogsToResponseRows } from "@/lib/gateway/gateway-log-response-rows";
import {
  scheduleOpportunisticGatewayPoll,
  parseGatewayLogPollParams,
} from "@/lib/gateway/log-read-poll-guard";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { resolveGatewaySessionBookUserId } from "@/lib/gateway/log-query-scope";
import { fetchCanvasQueueWithoutLogStats } from "@/lib/canvas/canvas-queue-without-log";
import {
  countGatewayLogsMerged,
  findGatewayLogsMerged,
} from "@/lib/maintenance/hotcold-archive-read";
import { isGatewayLogHistoryMode, gatewayLogHotCutoffDate } from "@/lib/gateway/gateway-hot-window";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireGatewaySessionUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const pollOpts = parseGatewayLogPollParams(request.nextUrl.searchParams);
    const statuses = request.nextUrl.searchParams.get("statuses")?.trim();
    const status = request.nextUrl.searchParams.get("status")?.trim();
    const isInFlightQuery =
      statuses?.includes("PENDING") ||
      statuses?.includes("RUNNING") ||
      status === "PENDING" ||
      status === "RUNNING";

    const page = parseLogPageParam(request.nextUrl.searchParams.get("page"));
    const pageSize = parseLogLimitParam(request.nextUrl.searchParams.get("limit"));
    const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);
    const historyMode = isGatewayLogHistoryMode(query.mode);

    scheduleOpportunisticGatewayPoll(user.id, {
      force: pollOpts.force,
      skip:
        pollOpts.skip ||
        historyMode ||
        (!pollOpts.force && !isInFlightQuery),
    });

    const scopeInput = {
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
    };

    let where;
    try {
      where = await buildDashboardLogWhere({ gatewaySessionUser: scopeInput.gatewaySessionUser, query });
    } catch (e) {
      if (e instanceof DashboardScopeError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const facetFilters = {
      status: query.filters.status,
      statuses: query.filters.statuses,
      submittedFrom: query.filters.submittedFrom,
      submittedTo: query.filters.submittedTo,
      clientSource: query.filters.clientSource,
      providerKind: query.filters.providerKind,
      storyProjectId: query.filters.storyProjectId,
    };
    const facetWhere = await buildDashboardLogWhere({
      gatewaySessionUser: scopeInput.gatewaySessionUser,
      query: { ...query, filters: facetFilters },
    });

    const providerKind = query.filters.providerKind;

    // 自动刷新 tick 传 facets=0：facets（按 provider/model/credential 分面，3~4 条额外查询）
    // 只在首屏 / 改筛选时才需要重算，8s 轮询不必每次都算，显著降低读页面对 DB 的压力。
    const facetsParam = request.nextUrl.searchParams.get("facets")?.trim();
    const includeFacets =
      !historyMode &&
      facetsParam !== "0" &&
      facetsParam !== "false";

    const bookUserId = await resolveGatewaySessionBookUserId(user);
    const isPlatformAdmin = bookUserId
      ? await canViewFinanceCost(bookUserId)
      : false;
    const canvasOwnerUserIds =
      isPlatformAdmin ? null : bookUserId ? [bookUserId] : [];
    const canvasQueueStaleMin = Math.max(
      1,
      Number(request.nextUrl.searchParams.get("canvasQueueStaleMin") ?? "2") || 2,
    );

    const skipCountParam = request.nextUrl.searchParams.get("skipCount")?.trim();
    /** skipCount=1：跳过 count（主表+归档双 count 很慢）；首屏/滚动追加均可用 */
    const skipCount = skipCountParam === "1" || skipCountParam === "true";

    const [total, facets, canvasQueueStats] = await Promise.all([
      skipCount
        ? Promise.resolve(null as number | null)
        : countGatewayLogsMerged(where, query.mode),
      includeFacets
        ? resolveGatewayLogListFacets(facetWhere, providerKind || undefined)
        : Promise.resolve(null),
      historyMode
        ? Promise.resolve(null)
        : fetchCanvasQueueWithoutLogStats({
            ownerUserIds: canvasOwnerUserIds,
            staleMinutes: canvasQueueStaleMin,
          }).catch(() => null),
    ]);

    const totalPages =
      total === null ? null : computeLogTotalPages(total, pageSize);
    const safePage =
      total === null
        ? Math.max(1, page)
        : total === 0
          ? 1
          : Math.min(Math.max(1, page), totalPages!);

    const logs = await findGatewayLogsMerged({
      where,
      mode: query.mode,
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      orderBy: { submittedAt: "desc" },
    });

    const rows = await mapGatewayRequestLogsToResponseRows(logs);
    const hasMore = logs.length === pageSize;

    return NextResponse.json({
      logs: rows,
      total,
      page: safePage,
      pageSize,
      totalPages,
      hasMore,
      mode: query.mode,
      hotCutoffMs: historyMode ? null : gatewayLogHotCutoffDate().getTime(),
      // facets=null 表示本次未重算，前端沿用上一次的分面值。
      facets,
      canvasQueueStats,
    });
  } catch (e) {
    if (isGatewayDatabaseError(e)) {
      console.error("[gateway/logs] database unavailable", e);
      return gatewayDatabaseUnavailableResponse();
    }
    throw e;
  }
}
