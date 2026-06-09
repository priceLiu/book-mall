import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";

export async function requirePaymentAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return null;
  }
  return session;
}

export function canUseAdminInstantCheckout(role: string | null | undefined): boolean {
  return canManagePricing(role);
}
