import type { GatewayRequestStatus } from "@prisma/client";
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
  parseLogSubmittedFromParam,
  parseLogSubmittedToParam,
} from "@/lib/gateway/log-query-params";
import { resolveGatewayLogListFacets } from "@/lib/gateway/log-list-facets";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { estimateVendorCost } from "@/lib/gateway/pricing-estimate";
import { maskApiKey } from "@/lib/canvas/secret";
import { buildGatewayLogWhere } from "@/lib/gateway/log-query-scope";
import { resolveGatewayLogAppTaskLinks } from "@/lib/gateway/log-app-task-link";
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
  const status = request.nextUrl.searchParams.get("status")?.trim();
  const clientSource = request.nextUrl.searchParams.get("clientSource")?.trim();
  const providerKind = request.nextUrl.searchParams.get("providerKind")?.trim();
  const model = request.nextUrl.searchParams.get("model")?.trim();
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim();
  const submittedFrom = parseLogSubmittedFromParam(
    request.nextUrl.searchParams.get("from"),
  );
  const submittedTo = parseLogSubmittedToParam(
    request.nextUrl.searchParams.get("to"),
  );

  const scopeInput = {
    gatewaySessionUser: {
      id: user.id,
      bookUserId: user.bookUserId,
      email: user.email,
    },
  };

  const listFilters = {
    status: status ? (status as GatewayRequestStatus) : undefined,
    submittedFrom: submittedFrom ?? undefined,
    submittedTo: submittedTo ?? undefined,
    clientSource: clientSource || undefined,
    providerKind: providerKind || undefined,
    model: model || undefined,
    credentialId: credentialId || undefined,
  };

  const where = await buildGatewayLogWhere(scopeInput, listFilters);

  const facetFilters = {
    status: listFilters.status,
    submittedFrom: listFilters.submittedFrom,
    submittedTo: listFilters.submittedTo,
    clientSource: listFilters.clientSource,
    providerKind: listFilters.providerKind,
  };
  const facetWhere = await buildGatewayLogWhere(scopeInput, facetFilters);

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

  const rows = await Promise.all(
    logs.map(async (l) => {
      const appTask = appTaskLinks.get(l.id);
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
