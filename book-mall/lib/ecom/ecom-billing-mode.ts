import type { EcomBillingMode } from "@prisma/client";

/** 只读：电商计费统一为平台代付按量 */
export async function getUserEcomBillingMode(
  _userId: string,
): Promise<EcomBillingMode> {
  return "PLATFORM_METERED";
}

/** @deprecated 用户不可改 ecomBillingMode */
export async function setUserEcomBillingMode(
  _userId: string,
  _mode: EcomBillingMode,
): Promise<EcomBillingMode> {
  return "PLATFORM_METERED";
}
