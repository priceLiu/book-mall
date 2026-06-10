import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { PaymentCheckoutsClient } from "@/components/admin/payment-checkouts-client";
import { ReconciliationClient } from "@/components/admin/reconciliation-client";
import { FinancePageShell } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function ReconciliationPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <FinancePageShell className="gap-12">
        <PaymentCheckoutsClient />
        <ReconciliationClient />
      </FinancePageShell>
    </FinanceAdminGate>
  );
}
