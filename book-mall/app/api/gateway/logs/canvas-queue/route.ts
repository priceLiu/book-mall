import { NextResponse, type NextRequest } from "next/server";

import { fetchCanvasQueueWithoutLogStats } from "@/lib/canvas/canvas-queue-without-log";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  gatewayDatabaseUnavailableResponse,
  isGatewayDatabaseError,
} from "@/lib/gateway/gateway-route-errors";
import { resolveGatewaySessionBookUserId } from "@/lib/gateway/log-query-scope";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

/** 轻量：画布视频 QUEUED/DISPATCHING 且尚无 Gateway log（供 Logs 页自动刷新） */
export async function GET(request: NextRequest) {
  try {
    const user = await requireGatewaySessionUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const bookUserId = await resolveGatewaySessionBookUserId(user);
    const isPlatformAdmin = bookUserId
      ? await canViewFinanceCost(bookUserId)
      : false;
    const ownerUserIds =
      isPlatformAdmin ? null : bookUserId ? [bookUserId] : [];

    const staleMinutes = Math.max(
      1,
      Number(request.nextUrl.searchParams.get("staleMin") ?? "2") || 2,
    );

    const stats = await fetchCanvasQueueWithoutLogStats({
      ownerUserIds,
      staleMinutes,
    });

    return NextResponse.json(stats);
  } catch (e) {
    if (isGatewayDatabaseError(e)) {
      return gatewayDatabaseUnavailableResponse();
    }
    throw e;
  }
}
