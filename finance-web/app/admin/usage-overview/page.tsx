import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { UsageOverviewClient } from "@/components/admin/usage-overview-client";

export const dynamic = "force-dynamic";

export default function UsageOverviewPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <UsageOverviewClient />
    </FinanceAdminGate>
  );
}
