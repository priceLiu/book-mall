import type { EcomBillingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";

/** 只读：由 billingPersona 推导 */
export async function getUserEcomBillingMode(
  userId: string,
): Promise<EcomBillingMode> {
  const persona = await getUserBillingPersona(userId);
  if (persona === "BYOK") return "BYOK_SERVICE_FEE";
  if (persona === "PLATFORM_CREDIT") return "PLATFORM_METERED";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ecomBillingMode: true, billingPersona: true },
  });
  if (user?.billingPersona === "BYOK") return "BYOK_SERVICE_FEE";
  return user?.ecomBillingMode ?? "PLATFORM_METERED";
}

/** @deprecated 用户不可改 ecomBillingMode；保留 API 兼容，仅同步 persona */
export async function setUserEcomBillingMode(
  userId: string,
  _mode: EcomBillingMode,
): Promise<EcomBillingMode> {
  return getUserEcomBillingMode(userId);
}
