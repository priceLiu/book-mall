import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { PaymentCheckoutsClient } from "@/components/admin/payment-checkouts-client";
import { ReconciliationClient } from "@/components/admin/reconciliation-client";

export const dynamic = "force-dynamic";

export default function ReconciliationPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <div className="space-y-12 p-6">
        <PaymentCheckoutsClient />
        <ReconciliationClient />
      </div>
    </FinanceAdminGate>
  );
}
