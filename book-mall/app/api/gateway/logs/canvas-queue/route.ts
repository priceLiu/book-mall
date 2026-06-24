import { NextResponse, type NextRequest } from "next/server";

import {
  fetchCanvasQueueWithoutLogStats,
  listCanvasQueuedWithoutLogTasks,
} from "@/lib/canvas/canvas-queue-without-log";
import { buildCanvasPendingLogRows } from "@/lib/canvas/canvas-pending-log-row";
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

    // 方向 2：?rows=1 时附带合成「排队中（待提交）」日志行，供 Logs 页第一时间展示完整过程
    const wantRows = request.nextUrl.searchParams.get("rows") === "1";
    if (!wantRows) {
      return NextResponse.json(stats);
    }

    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") ?? "50") || 50, 1),
      200,
    );
    const tasks = await listCanvasQueuedWithoutLogTasks({
      ownerUserIds,
      staleMinutes: 0,
      limit,
    });

    return NextResponse.json({
      ...stats,
      pendingRows: buildCanvasPendingLogRows(tasks),
    });
  } catch (e) {
    if (isGatewayDatabaseError(e)) {
      return gatewayDatabaseUnavailableResponse();
    }
    throw e;
  }
}
