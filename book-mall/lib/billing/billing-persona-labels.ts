/**
 * 用户可见文案：计费身份（界面勿出现英文 BYOK）。
 */
import type { BillingPersona } from "@prisma/client";

export const BILLING_PERSONA_LABELS: Record<
  BillingPersona,
  { short: string; mode: string; tagline: string }
> = {
  PLATFORM_CREDIT: {
    short: "平台代付",
    mode: "平台代付模式",
    tagline: "购买会员套餐，按积分扣费，无需自备云厂商 Key",
  },
  BYOK: {
    short: "自带 key 会员",
    mode: "自带 key 会员",
    tagline: "自备云厂商 API Key，模型费用由您与厂商直接结算",
  },
};

export function billingPersonaLabel(
  persona: BillingPersona | null | undefined,
  variant: "short" | "mode" = "short",
): string {
  if (!persona) return "未选择计费身份";
  return BILLING_PERSONA_LABELS[persona][variant];
}
