import { NextResponse, type NextRequest } from "next/server";

import { fetchDashboardStats } from "@/lib/gateway/log-dashboard-projection";
import {
  buildDashboardLogWhere,
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import {
  expireStaleGatewayLogs,
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    await runGatewayPollWorker({ limit: 30 });
  } catch {
    /* opportunistic */
  }
  try {
    await expireStaleGatewayLogs();
  } catch {
    /* ignore */
  }

  const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);

  try {
    const where = await buildDashboardLogWhere({
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
      query,
    });
    const stats = await fetchDashboardStats(where);
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof DashboardScopeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
