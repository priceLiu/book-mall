import { resolveSbv1BillingCanonicalFromInputSummary } from "@/lib/gateway/log-pricing-hints";

/** 日志 Model 列：优先 DB canonical，否则从 inputSummary 推断 sbv1 分档，避免裸露 doubao-* 厂商键 */
export function resolveGatewayLogDisplayModelKey(log: {
  model: string;
  canonicalModelKey?: string | null;
  inputSummary?: unknown;
}): string {
  const stored = log.canonicalModelKey?.trim();
  if (stored) return stored;

  const inferred = resolveSbv1BillingCanonicalFromInputSummary(
    log.inputSummary,
    log.model,
  );
  if (inferred?.trim()) return inferred.trim();

  return log.model.trim() || "—";
}
