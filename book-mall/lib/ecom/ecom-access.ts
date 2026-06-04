import { prisma } from "@/lib/prisma";
import { navKeysFromActiveToolServicePeriods } from "@/lib/tool-service-fee/periods";
import type { ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";

export const ECOM_TOOLKIT_NAV_KEY = "e-commerce-toolkit" as const;

export async function userCanAccessEcommerceToolkit(
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, ecomBillingMode: true },
  });
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.ecomBillingMode === "PLATFORM_METERED") return true;
  const keys = await navKeysFromActiveToolServicePeriods(userId);
  return keys.includes(ECOM_TOOLKIT_NAV_KEY as ToolSuiteNavKey);
}

export async function mergeEcomToolkitNavKeys(
  userId: string,
  keys: ToolSuiteNavKey[],
  isAdmin: boolean,
): Promise<ToolSuiteNavKey[]> {
  if (isAdmin) return keys;
  const granted = await userCanAccessEcommerceToolkit(userId);
  if (!granted) return keys;
  if (keys.includes(ECOM_TOOLKIT_NAV_KEY as ToolSuiteNavKey)) return keys;
  return [...keys, ECOM_TOOLKIT_NAV_KEY as ToolSuiteNavKey];
}
