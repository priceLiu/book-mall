import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { CreditPricingClient } from "@/components/admin/credit-pricing-client";

export const dynamic = "force-dynamic";

export default function CreditPricingPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <CreditPricingClient />
    </FinanceAdminGate>
  );
}
