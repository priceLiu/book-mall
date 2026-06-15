import {
  libNanoProCanonicalFromModelKey,
} from "@/lib/billing/lib-nano-pro-canonical";
import {
  sbv1VideoCanonicalFromParams,
  sbv1VideoCanonicalKey,
} from "@/lib/billing/sbv1-video-canonical";

/** 从 Gateway 日志 inputSummary 解析视频计价参数 */

export type VideoPricingHints = {
  durationSec?: number;
  tierRaw?: string;
};

function readInputObject(inputSummary: unknown): Record<string, unknown> {
  if (!inputSummary || typeof inputSummary !== "object") return {};
  const root = inputSummary as Record<string, unknown>;
  const input = root.input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return root;
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

export function parseVideoPricingHints(
  inputSummary: unknown,
): VideoPricingHints {
  const input = readInputObject(inputSummary);
  const durationSec =
    parsePositiveInt(input.duration) ??
    parsePositiveInt(input.durationSec) ??
    parsePositiveInt(
      input.parameters &&
        typeof input.parameters === "object" &&
        !Array.isArray(input.parameters)
        ? (input.parameters as Record<string, unknown>).duration
        : undefined,
    );

  let tierRaw: string | undefined;
  const resolution = input.resolution ?? input.video_resolution;
  if (typeof resolution === "string" && resolution.trim()) {
    tierRaw = resolution.trim().toUpperCase();
  } else if (typeof input.resolution === "string") {
    tierRaw = input.resolution.trim().toLowerCase().includes("1080")
      ? "1080P"
      : input.resolution.trim().toLowerCase().includes("720")
        ? "720P"
        : undefined;
  }

  return { durationSec, tierRaw };
}

function readSbv1BillingBlock(inputSummary: unknown): Record<string, unknown> | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  const input = readInputObject(inputSummary);
  const direct = root.sbv1Billing;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  const nested = input.sbv1Billing;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return null;
}

function readResolutionFromBillingOrInput(
  billing: Record<string, unknown> | null,
  input: Record<string, unknown>,
): string | null {
  if (billing) {
    if (typeof billing.resolution === "string" && billing.resolution.trim()) {
      return billing.resolution.trim();
    }
    const params =
      billing.paramsSnapshot && typeof billing.paramsSnapshot === "object"
        ? (billing.paramsSnapshot as Record<string, unknown>)
        : null;
    if (params && typeof params.resolution === "string" && params.resolution.trim()) {
      return params.resolution.trim();
    }
  }
  if (typeof input.resolution === "string" && input.resolution.trim()) {
    return input.resolution.trim();
  }
  return null;
}

/** sbv1 / nano-banana 分档 canonical；未命中返回 null（调用方再 fallback resolveCanonicalModelKey）。 */
export function resolveSbv1BillingCanonicalFromInputSummary(
  inputSummary: unknown,
  modelKey?: string | null,
): string | null {
  const billing = readSbv1BillingBlock(inputSummary);
  const input = readInputObject(inputSummary);
  const effectiveModelKey =
    (typeof billing?.modelKey === "string" ? billing.modelKey : null) ?? modelKey;
  const resolution = readResolutionFromBillingOrInput(billing, input);

  const fromNano = libNanoProCanonicalFromModelKey(effectiveModelKey, resolution);
  if (fromNano) return fromNano;

  if (billing) {
    const fromVariant = sbv1VideoCanonicalKey(
      typeof billing.volcengineVariantId === "string"
        ? billing.volcengineVariantId
        : null,
    );
    if (fromVariant) return fromVariant;

    const params =
      billing.paramsSnapshot && typeof billing.paramsSnapshot === "object"
        ? (billing.paramsSnapshot as Record<string, unknown>)
        : {};
    const fromParams = sbv1VideoCanonicalFromParams({
      modelKey: effectiveModelKey,
      resolution:
        typeof params.resolution === "string"
          ? params.resolution
          : resolution,
      tier: typeof params.tier === "string" ? params.tier : null,
    });
    if (fromParams) return fromParams;
  }

  const variantId =
    typeof input.volcengineVariantId === "string" ? input.volcengineVariantId : null;
  const fromInputVariant = sbv1VideoCanonicalKey(variantId);
  if (fromInputVariant) return fromInputVariant;

  return sbv1VideoCanonicalFromParams({
    modelKey,
    resolution,
    tier: typeof input.tier === "string" ? input.tier : null,
  });
}
