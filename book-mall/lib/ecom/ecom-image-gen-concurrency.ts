import { resolveVideoRiskLimits } from "@/lib/billing/video-risk-control";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import type { ProductDesignSettings } from "@/lib/ecom/ecom-product-design-types";

/**
 * 无会员加速 / 无团队并发加成时的标准默认（见 ecom-generation-concurrency-spec.md）。
 */
export const ECOM_GENERATION_STANDARD_CONCURRENCY = 2;

/** @deprecated 使用 ECOM_GENERATION_STANDARD_CONCURRENCY */
export const ECOM_IMAGE_GEN_DEFAULT_CONCURRENCY = ECOM_GENERATION_STANDARD_CONCURRENCY;

export const ECOM_PROMPT_GEN_DEFAULT_CONCURRENCY = ECOM_GENERATION_STANDARD_CONCURRENCY;

export const ECOM_IMAGE_GEN_MAX_CONCURRENCY = 5;
export const ECOM_PROMPT_GEN_MAX_CONCURRENCY = 5;

async function resolveEcomGenerationConcurrency(
  userId: string,
  maxCap: number,
  override?: number,
): Promise<number> {
  if (typeof override === "number" && override >= 1) {
    return Math.min(maxCap, Math.round(override));
  }
  try {
    const auth = await resolveEcomGatewayAuthForUser(userId);
    if (auth?.id) {
      const limits = await resolveVideoRiskLimits({
        actorBookUserId: userId,
        apiKeyId: auth.id,
      });
      if (limits?.maxConcurrency && limits.maxConcurrency > 0) {
        return Math.min(maxCap, limits.maxConcurrency);
      }
    }
  } catch {
    /* 兜底标准默认 */
  }
  return ECOM_GENERATION_STANDARD_CONCURRENCY;
}

/** 批量出图并发：套餐 maxConcurrency，无套餐则标准默认 2（不由用户在页面选择） */
export async function resolveEcomImageGenConcurrency(
  userId: string,
  _settings: ProductDesignSettings,
  override?: number,
): Promise<number> {
  return resolveEcomGenerationConcurrency(
    userId,
    ECOM_IMAGE_GEN_MAX_CONCURRENCY,
    override,
  );
}

/** 批量写提示词（LLM）并发：与出图同一套餐来源，cap 5，无套餐则标准默认 2 */
export async function resolveEcomPromptGenConcurrency(
  userId: string,
  override?: number,
): Promise<number> {
  return resolveEcomGenerationConcurrency(
    userId,
    ECOM_PROMPT_GEN_MAX_CONCURRENCY,
    override,
  );
}
