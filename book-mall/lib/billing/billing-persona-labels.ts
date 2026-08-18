/**
 * 用户可见文案：计费身份
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
    short: "平台代付",
    mode: "平台代付模式",
    tagline: "购买会员套餐，按积分扣费",
  },
};

export function billingPersonaLabel(
  persona: BillingPersona | null | undefined,
  variant: "short" | "mode" = "short",
): string {
  if (!persona) return "未选择计费身份";
  const key = persona === "BYOK" ? "PLATFORM_CREDIT" : persona;
  return BILLING_PERSONA_LABELS[key][variant];
}
