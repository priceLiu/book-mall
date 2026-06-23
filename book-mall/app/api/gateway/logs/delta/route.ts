import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireGatewaySessionUser } from "@/lib/gateway/session";
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
import { isGatewayLogHistoryMode } from "@/lib/gateway/gateway-hot-window";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 单次增量最多返回的新行数（防止 since 过旧时一次性拉太多） */
const CREATED_LIMIT = 100;
/** 单次刷新的在途行 id 上限 */
const REFRESH_IDS_LIMIT = 200;

function parseRefreshIds(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, REFRESH_IDS_LIMIT);
}

/**
 * 日志列表「只加新数据」增量端点。
 *
 * 自动刷新（page=1、按 submittedAt desc）时调用：
 * - `created`：submittedAt ≥ since 的新行（前端去重后前插）
 * - `updated`：since 之前已展示、仍在途的行（按 id 刷新状态/计时）
 *
 * 不做 count / facets / 全量 findMany，显著降低每 8s 轮询对 DB 的压力。
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireGatewaySessionUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const pollOpts = parseGatewayLogPollParams(params);
    const refreshIds = parseRefreshIds(params.get("ids"));
    const hasInFlight = refreshIds.length > 0;

    const query = parseDashboardQueryFromSearchParams(params);
    const historyMode = isGatewayLogHistoryMode(query.mode);

    if (historyMode) {
      return NextResponse.json({
        created: [],
        updated: [],
        serverNowMs: Date.now(),
        sinceApplied: null,
      });
    }

    scheduleOpportunisticGatewayPoll(user.id, {
      force: pollOpts.force,
      skip: pollOpts.skip || (!pollOpts.force && !hasInFlight),
    });

    const sinceRaw = params.get("since")?.trim();
    const sinceMs = sinceRaw ? Date.parse(sinceRaw) : NaN;
    const sinceDate = Number.isFinite(sinceMs) ? new Date(sinceMs) : null;

    const sessionUser = {
      id: user.id,
      bookUserId: user.bookUserId,
      email: user.email,
    };

    let where: Prisma.GatewayRequestLogWhereInput;
    let refreshWhere: Prisma.GatewayRequestLogWhereInput;
    try {
      where = await buildDashboardLogWhere({ gatewaySessionUser: sessionUser, query });
      // 刷新在途行：保留 scope + 不可变筛选（source/provider/model/credential/project），
      // 丢弃 status/时间，确保 RUNNING→SUCCEEDED 等状态跃迁也能被刷新到。
      refreshWhere = hasInFlight
        ? await buildDashboardLogWhere({
            gatewaySessionUser: sessionUser,
            query: {
              ...query,
              filters: {
                clientSource: query.filters.clientSource,
                providerKind: query.filters.providerKind,
                model: query.filters.model,
                credentialId: query.filters.credentialId,
                storyProjectId: query.filters.storyProjectId,
              },
            },
          })
        : where;
    } catch (e) {
      if (e instanceof DashboardScopeError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const [createdLogs, updatedLogs] = await Promise.all([
      sinceDate
        ? prisma.gatewayRequestLog.findMany({
            where: { AND: [where, { submittedAt: { gte: sinceDate } }] },
            orderBy: { submittedAt: "desc" },
            take: CREATED_LIMIT,
          })
        : Promise.resolve([]),
      hasInFlight
        ? prisma.gatewayRequestLog.findMany({
            where: { AND: [refreshWhere, { id: { in: refreshIds } }] },
            take: REFRESH_IDS_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    const [created, updated] = await Promise.all([
      mapGatewayRequestLogsToResponseRows(createdLogs),
      mapGatewayRequestLogsToResponseRows(updatedLogs),
    ]);

    return NextResponse.json({
      created,
      updated,
      serverNowMs: Date.now(),
      // since 未传时为 null，前端应回退到全量加载。
      sinceApplied: sinceDate ? sinceDate.toISOString() : null,
    });
  } catch (e) {
    if (isGatewayDatabaseError(e)) {
      console.error("[gateway/logs/delta] database unavailable", e);
      return gatewayDatabaseUnavailableResponse();
    }
    throw e;
  }
}
