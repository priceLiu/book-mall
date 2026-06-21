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
  maybeRunOpportunisticGatewayPoll,
  parseGatewayLogPollParams,
} from "@/lib/gateway/log-read-poll-guard";
import { prisma } from "@/lib/prisma";

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

    await maybeRunOpportunisticGatewayPoll(user.id, {
      force: pollOpts.force,
      skip: pollOpts.skip || (!pollOpts.force && !isInFlightQuery),
    });

    const page = parseLogPageParam(request.nextUrl.searchParams.get("page"));
    const pageSize = parseLogLimitParam(request.nextUrl.searchParams.get("limit"));
    const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);

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

    const [total, facets] = await Promise.all([
      prisma.gatewayRequestLog.count({ where }),
      resolveGatewayLogListFacets(facetWhere, providerKind || undefined),
    ]);

    const totalPages = computeLogTotalPages(total, pageSize);
    const safePage =
      total === 0 ? 1 : Math.min(Math.max(1, page), totalPages);

    const logs = await prisma.gatewayRequestLog.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    });

    const rows = await mapGatewayRequestLogsToResponseRows(logs);

    return NextResponse.json({
      logs: rows,
      total,
      page: safePage,
      pageSize,
      totalPages,
      facets,
    });
  } catch (e) {
    if (isGatewayDatabaseError(e)) {
      console.error("[gateway/logs] database unavailable", e);
      return gatewayDatabaseUnavailableResponse();
    }
    throw e;
  }
}
