import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ReconciliationClient } from "@/components/admin/reconciliation-client";
import { FinancePageShell } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function ReconciliationPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <FinancePageShell>
        <ReconciliationClient />
      </FinancePageShell>
    </FinanceAdminGate>
  );
}
