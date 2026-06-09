import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ScenarioLabClient } from "@/components/admin/scenario-lab-client";

export const dynamic = "force-dynamic";

export default function ScenarioLabPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <ScenarioLabClient />
    </FinanceAdminGate>
  );
}
