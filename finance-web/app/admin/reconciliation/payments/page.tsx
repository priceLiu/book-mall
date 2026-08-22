import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { PaymentCheckoutsClient } from "@/components/admin/payment-checkouts-client";
import { FinancePageShell } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function ReconciliationPaymentsPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <FinancePageShell>
        <PaymentCheckoutsClient />
      </FinancePageShell>
    </FinanceAdminGate>
  );
}
