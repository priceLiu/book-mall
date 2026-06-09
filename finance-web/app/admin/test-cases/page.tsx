import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { FinanceTestCasesClient } from "@/components/admin/finance-test-cases-client";

export const dynamic = "force-dynamic";

export default function FinanceTestCasesPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <FinanceTestCasesClient />
    </FinanceAdminGate>
  );
}
