import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ReconciliationClient } from "@/components/admin/reconciliation-client";

export const dynamic = "force-dynamic";

export default function ReconciliationPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <ReconciliationClient />
    </FinanceAdminGate>
  );
}
