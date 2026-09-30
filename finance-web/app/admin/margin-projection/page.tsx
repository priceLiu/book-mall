import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { MarginProjectionClient } from "@/components/admin/margin-projection-client";

export const dynamic = "force-dynamic";

export default function MarginProjectionPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <MarginProjectionClient />
    </FinanceAdminGate>
  );
}
