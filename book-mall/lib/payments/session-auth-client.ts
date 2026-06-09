import { canManagePricing } from "@/lib/auth/permissions";

export function canUseAdminInstantCheckout(role: string | null | undefined): boolean {
  return canManagePricing(role);
}
