import type { GatewayRequestLog } from "@prisma/client";

import { maskApiKey } from "@/lib/canvas/secret";
import { resolveGatewayTokenMetrics } from "@/lib/gateway/gateway-token-metrics";
import { fetchGatewayLogActorDisplays } from "@/lib/gateway/log-dashboard-actor";
import { resolveGatewayLogAppTaskLinks } from "@/lib/gateway/log-app-task-link";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { resolveGatewayLogDisplayModelKey } from "@/lib/gateway/gateway-log-display-model";
import {
  resolveVendorNativeTimingForLogRow,
  resolveVolcengineLogTiming,
} from "@/lib/gateway/log-volcengine-timing";
import { estimateVendorCost } from "@/lib/gateway/pricing-estimate";
import { resolveGatewayLogVendorRequestId } from "@/lib/gateway/vendor-request-id";
import { readPollStallDiagnostic } from "@/lib/gateway/gateway-poll-stall-diagnostics";
import { prisma } from "@/lib/prisma";

export async function mapGatewayRequestLogsToResponseRows(
  logs: GatewayRequestLog[],
) {
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

  return Promise.all(
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
      const vendorNative = resolveVendorNativeTimingForLogRow({
        providerKind: l.providerKind,
        requestKind: l.requestKind,
        vendorDurationMs: l.vendorDurationMs,
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
        displayModelKey: resolveGatewayLogDisplayModelKey({
          model: l.model,
          canonicalModelKey: l.canonicalModelKey,
          inputSummary: l.inputSummary,
        }),
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
        vendorPostProcessMs: timing?.vendorPostProcessMs ?? null,
        pollDelayMs: timing?.pollDelayMs ?? null,
        pollDelayOverLimit: timing?.pollDelayOverLimit ?? false,
        pollStallDiagnostic: readPollStallDiagnostic(l.resultSummary),
        vendorNativeDurationMs: vendorNative.vendorNativeDurationMs,
        vendorNativeGenerateMs: vendorNative.vendorNativeGenerateMs,
        estimatedVendorCostYuan,
        failCode: l.failCode,
        failMessage: l.failMessage,
        billingCategory: l.billingCategory,
        storyProjectId: l.storyProjectId,
        inputSummary: l.inputSummary,
        resultSummary: l.resultSummary,
        submittedAt: l.submittedAt.toISOString(),
        completedAt: l.completedAt?.toISOString() ?? null,
        updatedAt: l.updatedAt.toISOString(),
      };
    }),
  );
}
