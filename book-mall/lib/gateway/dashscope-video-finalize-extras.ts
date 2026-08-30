import type { GatewayRequestLog } from "@prisma/client";

import { mergeS2vDurationIntoResultSummary } from "@/lib/finance/infer-s2v-video-seconds";
import { resolveReconciliationVideoSeconds } from "@/lib/finance/reconciliation-v2/billable-units";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";

type LogSlice = Pick<
  GatewayRequestLog,
  "inputSummary" | "model" | "canonicalModelKey" | "requestKind"
>;

/** 百炼/DashScope 视频终态：补 usage.duration + pricingTierRaw（对账 joinKey）。 */
export function dashscopeVideoFinalizeExtras(
  log: LogSlice,
  resultSummary: unknown,
): { resultSummary: unknown; pricingTierRaw?: string } {
  const hints = parseVideoPricingHints(log.inputSummary);
  const pricingTierRaw = hints.tierRaw;
  if (log.requestKind !== "VIDEO") {
    return { resultSummary, pricingTierRaw };
  }
  const sec = resolveReconciliationVideoSeconds({
    ...log,
    resultSummary,
    inputSummary: log.inputSummary,
  });
  if (sec <= 0) {
    return { resultSummary, pricingTierRaw };
  }
  return {
    resultSummary: mergeS2vDurationIntoResultSummary(resultSummary, sec),
    pricingTierRaw,
  };
}
