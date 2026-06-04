import type { EcomBillingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getUserEcomBillingMode(
  userId: string,
): Promise<EcomBillingMode> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ecomBillingMode: true },
  });
  return user?.ecomBillingMode ?? "BYOK_SERVICE_FEE";
}

export async function setUserEcomBillingMode(
  userId: string,
  mode: EcomBillingMode,
): Promise<EcomBillingMode> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { ecomBillingMode: mode },
    select: { ecomBillingMode: true },
  });
  return updated.ecomBillingMode;
}

/** 6a 模式下 usage 走 Scheme A；6b 走 serviceFeeMode */
export async function shouldMeterEcomToolkitUsage(
  userId: string,
  toolKey: string,
): Promise<boolean> {
  if (!toolKey.trim().startsWith("ecom-toolkit")) return false;
  const mode = await getUserEcomBillingMode(userId);
  return mode === "PLATFORM_METERED";
}
