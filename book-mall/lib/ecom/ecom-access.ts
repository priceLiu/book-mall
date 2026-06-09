import { prisma } from "@/lib/prisma";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { userHasMembershipToolAccess } from "@/lib/membership-tool-access";
import type { ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";

export const ECOM_TOOLKIT_NAV_KEY = "e-commerce-toolkit" as const;

export async function userCanAccessEcommerceToolkit(
  userId: string,
): Promise<boolean> {
  const persona = await getUserBillingPersona(userId);
  if (persona === "PLATFORM_CREDIT") return userHasMembershipToolAccess(userId);
  if (persona === "BYOK") return userHasMembershipToolAccess(userId);
  return userHasMembershipToolAccess(userId);
}

export async function mergeEcomToolkitNavKeys(
  userId: string,
  keys: ToolSuiteNavKey[],
  _isAdmin: boolean,
): Promise<ToolSuiteNavKey[]> {
  const granted = await userCanAccessEcommerceToolkit(userId);
  if (!granted) return keys;
  if (keys.includes(ECOM_TOOLKIT_NAV_KEY as ToolSuiteNavKey)) return keys;
  return [...keys, ECOM_TOOLKIT_NAV_KEY as ToolSuiteNavKey];
}
