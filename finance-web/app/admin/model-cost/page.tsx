import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ModelCostClient } from "@/components/admin/model-cost-client";

export const dynamic = "force-dynamic";

export default function ModelCostPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <ModelCostClient />
    </FinanceAdminGate>
  );
}
