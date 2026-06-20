import { NextResponse, type NextRequest } from "next/server";

import {
  buildDashboardLogWhere,
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import {
  fetchGatewayLogActorDisplays,
  type GatewayLogActorDisplay,
} from "@/lib/gateway/log-dashboard-actor";
import { resolveGatewayLogAppTaskLinks } from "@/lib/gateway/log-app-task-link";
import { resolveVolcengineLogTiming } from "@/lib/gateway/log-volcengine-timing";
import {
  computeLogTotalPages,
  GATEWAY_LOG_PAGE_SIZE_MAX,
  parseLogLimitParam,
} from "@/lib/gateway/log-query-params";
import { billingCategoryLabel, resolveBillingCategory } from "@/lib/billing/billing-category";
import { resolveGatewayFailCodeDisplay } from "@/lib/gateway/log-fail-code";
import { maybeRunOpportunisticGatewayPoll } from "@/lib/gateway/log-read-poll-guard";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EXPORT_MAX_ROWS = 2000;

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  await maybeRunOpportunisticGatewayPoll(user.id, { skip: true });

  const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);
  const format = request.nextUrl.searchParams.get("format")?.trim().toLowerCase();

  try {
    const where = await buildDashboardLogWhere({
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
      query,
    });

    const limit = Math.min(
      EXPORT_MAX_ROWS,
      parseLogLimitParam(
        request.nextUrl.searchParams.get("limit"),
        EXPORT_MAX_ROWS,
      ),
    );

    const logs = await prisma.gatewayRequestLog.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: limit,
    });

    const actorIds = logs
      .map((l) => l.actorBookUserId)
      .filter((id): id is string => !!id);
    const [actorMap, appTaskLinks] = await Promise.all([
      fetchGatewayLogActorDisplays(actorIds),
      resolveGatewayLogAppTaskLinks(logs),
    ]);

    const rows = logs.map((l) => {
      const actor: GatewayLogActorDisplay | null =
        l.actorBookUserId != null
          ? (actorMap.get(l.actorBookUserId) ?? null)
          : null;
      const timing = resolveVolcengineLogTiming({
        providerKind: l.providerKind,
        requestKind: l.requestKind,
        submittedAt: l.submittedAt,
        completedAt: l.completedAt,
        resultSummary: l.resultSummary,
      });
      const category = resolveBillingCategory(l, l.billingCategory);
      const appTask = appTaskLinks.get(l.id);
      const failCode = resolveGatewayFailCodeDisplay({
        failCode: l.failCode,
        failMessage: l.failMessage,
      });

      return {
        id: l.id,
        status: l.status,
        failCode,
        failMessage: l.failMessage,
        model: l.canonicalModelKey ?? l.model,
        billingCategory: category,
        billingCategoryLabel: billingCategoryLabel(category),
        durationMs: l.durationMs,
        queueMs: timing?.queueMs ?? null,
        generateMs: timing?.generateMs ?? null,
        pollDelayMs: timing?.pollDelayMs ?? null,
        clientSource: l.clientSource,
        clientPage: l.clientPage,
        tenantId: l.tenantId,
        storyProjectId: l.storyProjectId,
        appTaskId: appTask?.appTaskId ?? l.storyTaskId ?? null,
        submittedAt: l.submittedAt.toISOString(),
        completedAt: l.completedAt?.toISOString() ?? null,
        actorBookUserId: l.actorBookUserId,
        actorPhone: actor?.phone ?? null,
        actorName: actor?.name ?? null,
        actorDisplayLabel: actor?.displayLabel ?? null,
      };
    });

    if (format === "csv") {
      const headers = [
        "id",
        "status",
        "failCode",
        "failMessage",
        "model",
        "billingCategory",
        "durationMs",
        "queueMs",
        "generateMs",
        "pollDelayMs",
        "actorPhone",
        "actorName",
        "actorDisplayLabel",
        "clientSource",
        "clientPage",
        "submittedAt",
        "completedAt",
      ];
      const csvRows = rows.map((r) => [
        r.id,
        r.status,
        r.failCode,
        r.failMessage ?? "",
        r.model,
        r.billingCategoryLabel,
        r.durationMs ?? "",
        r.queueMs ?? "",
        r.generateMs ?? "",
        r.pollDelayMs ?? "",
        r.actorPhone ?? "",
        r.actorName ?? "",
        r.actorDisplayLabel ?? "",
        r.clientSource,
        r.clientPage ?? "",
        r.submittedAt,
        r.completedAt ?? "",
      ]);
      const csv = buildCsv(headers, csvRows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gateway-status-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      rows,
      total: rows.length,
      truncated: logs.length >= limit,
    });
  } catch (e) {
    if (e instanceof DashboardScopeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
