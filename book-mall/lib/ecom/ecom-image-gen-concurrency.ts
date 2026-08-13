import { resolveVideoRiskLimits } from "@/lib/billing/video-risk-control";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import type { ProductDesignSettings } from "@/lib/ecom/ecom-product-design-types";

export const ECOM_IMAGE_GEN_DEFAULT_CONCURRENCY = 2;
export const ECOM_IMAGE_GEN_MAX_CONCURRENCY = 5;

/** 批量出图并发：账户/团队 Gateway 并发上限，默认 2（不由用户在页面选择） */
export async function resolveEcomImageGenConcurrency(
  userId: string,
  _settings: ProductDesignSettings,
  override?: number,
): Promise<number> {
  if (typeof override === "number" && override >= 1) {
    return Math.min(ECOM_IMAGE_GEN_MAX_CONCURRENCY, Math.round(override));
  }
  try {
    const auth = await resolveEcomGatewayAuthForUser(userId);
    if (auth?.id) {
      const limits = await resolveVideoRiskLimits({
        actorBookUserId: userId,
        apiKeyId: auth.id,
      });
      if (limits?.maxConcurrency && limits.maxConcurrency > 0) {
        return Math.min(ECOM_IMAGE_GEN_MAX_CONCURRENCY, limits.maxConcurrency);
      }
    }
  } catch {
    /* 兜底默认并发 */
  }
  return ECOM_IMAGE_GEN_DEFAULT_CONCURRENCY;
}
