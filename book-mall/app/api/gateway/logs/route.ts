import { NextResponse, type NextRequest } from "next/server";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import {
  expireStaleGatewayLogs,
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";
import {
  computeLogTotalPages,
  parseLogLimitParam,
  parseLogPageParam,
} from "@/lib/gateway/log-query-params";
import { resolveGatewayLogListFacets } from "@/lib/gateway/log-list-facets";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { estimateVendorCost } from "@/lib/gateway/pricing-estimate";
import { maskApiKey } from "@/lib/canvas/secret";
import {
  buildDashboardLogWhere,
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import { resolveGatewayLogAppTaskLinks } from "@/lib/gateway/log-app-task-link";
import { fetchGatewayLogActorDisplays } from "@/lib/gateway/log-dashboard-actor";
import { resolveVolcengineLogTiming } from "@/lib/gateway/log-volcengine-timing";
import { resolveGatewayLogVendorRequestId } from "@/lib/gateway/vendor-request-id";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    await runGatewayPollWorker({ limit: 30 });
  } catch {
    /* 列表页 opportunistic 轮询 */
  }
  try {
    await expireStaleGatewayLogs();
  } catch {
    /* ignore */
  }

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

  const credentialIds = [
    ...new Set(
      logs.map((l) => l.credentialId).filter((id): id is string => !!id),
    ),
  ];
  const credentialRows =
    credentialIds.length > 0
      ? await prisma.gatewayVendorCredential.findMany({
          where: { id: { in: credentialIds } },
          select: { id: true, apiKeyEncrypted: true },
        })
      : [];
  const credentialKeyById = new Map(
    credentialRows.map((c) => [c.id, maskApiKey(c.apiKeyEncrypted)]),
  );

  const appTaskLinks = await resolveGatewayLogAppTaskLinks(logs);

  const actorIds = logs
    .map((l) => l.actorBookUserId)
    .filter((id): id is string => !!id);
  const actorMap = await fetchGatewayLogActorDisplays(actorIds);

  const rows = await Promise.all(
    logs.map(async (l) => {
      const appTask = appTaskLinks.get(l.id);
      const actor =
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
      let estimatedVendorCostYuan = l.estimatedVendorCostYuan?.toString() ?? null;
      if (
        l.status === "SUCCEEDED" &&
        l.requestKind === "VIDEO" &&
        (estimatedVendorCostYuan == null ||
          estimatedVendorCostYuan === "" ||
          Number(estimatedVendorCostYuan) <= 0)
      ) {
        const hints = parseVideoPricingHints(l.inputSummary);
        const est = await estimateVendorCost({
          modelKey: l.model,
          durationSec: hints.durationSec,
          tierRaw: hints.tierRaw,
          requestKind: l.requestKind,
        });
        if (est.estimatedVendorCostYuan != null && est.estimatedVendorCostYuan > 0) {
          estimatedVendorCostYuan = String(est.estimatedVendorCostYuan);
        }
      }

      let promptTokens = l.promptTokens;
      let completionTokens = l.completionTokens;
      let totalTokens = l.totalTokens;
      let metricsSource = l.metricsSource;
      if (
        l.status === "SUCCEEDED" &&
        (!l.hasTokenUsage || !totalTokens || totalTokens <= 0)
      ) {
        const tm = resolveGatewayTokenMetrics({
          inputSummary: l.inputSummary,
          resultSummary: l.resultSummary,
          requestKind: l.requestKind,
        });
        if (tm.hasTokenUsage) {
          promptTokens = tm.promptTokens;
          completionTokens = tm.completionTokens;
          totalTokens = tm.totalTokens;
          metricsSource = tm.metricsSource;
        }
      }

      return {
        id: l.id,
        model: l.model,
        canonicalModelKey: l.canonicalModelKey,
        endpoint: l.endpoint,
        status: l.status,
        requestKind: l.requestKind,
        providerKind: l.providerKind,
        tenantId: l.tenantId,
        actorBookUserId: l.actorBookUserId,
        actorPhone: actor?.phone ?? null,
        actorName: actor?.name ?? null,
        actorDisplayLabel: actor?.displayLabel ?? null,
        creditsCharged: l.creditsCharged,
        credentialKeyMasked: l.credentialId
          ? (credentialKeyById.get(l.credentialId) ?? null)
          : null,
        credentialId: l.credentialId,
        clientSource: l.clientSource,
        clientPage: l.clientPage,
        externalTaskId: l.externalTaskId,
        vendorRequestId: resolveGatewayLogVendorRequestId({
          vendorRequestId: l.vendorRequestId,
          failMessage: l.failMessage,
        }),
        promptTokens,
        completionTokens,
        totalTokens,
        metricsSource,
        durationMs: l.durationMs,
        vendorDurationMs: l.vendorDurationMs,
        storyTaskId: l.storyTaskId,
        appTaskId: appTask?.appTaskId ?? l.storyTaskId ?? null,
        appTaskKind: appTask?.appTaskKind ?? null,
        appTaskNodeId: appTask?.nodeId ?? null,
        queueMs: timing?.queueMs ?? null,
        generateMs: timing?.generateMs ?? null,
        pollDelayMs: timing?.pollDelayMs ?? null,
        pollDelayOverLimit: timing?.pollDelayOverLimit ?? false,
        estimatedVendorCostYuan,
        failCode: l.failCode,
        failMessage: l.failMessage,
        billingCategory: l.billingCategory,
        storyProjectId: l.storyProjectId,
        inputSummary: l.inputSummary,
        resultSummary: l.resultSummary,
        submittedAt: l.submittedAt.toISOString(),
        completedAt: l.completedAt?.toISOString() ?? null,
      };
    }),
  );

  return NextResponse.json({
    logs: rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
    facets,
  });
}
