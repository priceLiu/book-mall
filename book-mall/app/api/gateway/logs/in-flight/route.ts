import { NextResponse, type NextRequest } from "next/server";

import {
  buildDashboardLogWhere,
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import { DASHBOARD_IN_PROGRESS_STATUSES } from "@/lib/gateway/log-dashboard-projection";
import { mapGatewayRequestLogsToResponseRows } from "@/lib/gateway/gateway-log-response-rows";
import {
  maybeRunOpportunisticGatewayPoll,
  parseGatewayLogPollParams,
} from "@/lib/gateway/log-read-poll-guard";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const IN_FLIGHT_LIMIT = 100;

/** 仅返回进行中的任务（轻量轮询；限流 opportunistic poll）。 */
export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const pollOpts = parseGatewayLogPollParams(request.nextUrl.searchParams);
  await maybeRunOpportunisticGatewayPoll(user.id, {
    force: pollOpts.force,
    skip: pollOpts.skip,
  });

  const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);
  let where;
  try {
    const baseWhere = await buildDashboardLogWhere({
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
      query,
    });
    where = {
      AND: [baseWhere, { status: { in: DASHBOARD_IN_PROGRESS_STATUSES } }],
    };
  } catch (e) {
    if (e instanceof DashboardScopeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const [total, logs] = await Promise.all([
    prisma.gatewayRequestLog.count({ where }),
    prisma.gatewayRequestLog.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: IN_FLIGHT_LIMIT,
    }),
  ]);

  const rows = await mapGatewayRequestLogsToResponseRows(logs);

  return NextResponse.json({
    logs: rows,
    total,
    limit: IN_FLIGHT_LIMIT,
    serverTime: new Date().toISOString(),
  });
}
