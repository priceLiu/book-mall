import { NextResponse, type NextRequest } from "next/server";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import {
  expireStaleGatewayLogs,
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";
import {
  parseLogSubmittedFromParam,
  parseLogSubmittedToParam,
} from "@/lib/gateway/log-query-params";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { estimateVendorCost } from "@/lib/gateway/pricing-estimate";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    await runGatewayPollWorker({ limit: 15 });
  } catch {
    /* 列表页 opportunistic 轮询 */
  }
  try {
    await expireStaleGatewayLogs();
  } catch {
    /* ignore */
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "50")),
  );
  const status = request.nextUrl.searchParams.get("status")?.trim();
  const submittedFrom = parseLogSubmittedFromParam(
    request.nextUrl.searchParams.get("from"),
  );
  const submittedTo = parseLogSubmittedToParam(
    request.nextUrl.searchParams.get("to"),
  );

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      userId: user.id,
      ...(status ? { status: status as never } : {}),
      ...(submittedFrom || submittedTo
        ? {
            submittedAt: {
              ...(submittedFrom ? { gte: submittedFrom } : {}),
              ...(submittedTo ? { lte: submittedTo } : {}),
            },
          }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });

  const rows = await Promise.all(
    logs.map(async (l) => {
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
        endpoint: l.endpoint,
        status: l.status,
        requestKind: l.requestKind,
        providerKind: l.providerKind,
        clientSource: l.clientSource,
        clientPage: l.clientPage,
        externalTaskId: l.externalTaskId,
        promptTokens,
        completionTokens,
        totalTokens,
        metricsSource,
        durationMs: l.durationMs,
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

  return NextResponse.json({ logs: rows });
}
