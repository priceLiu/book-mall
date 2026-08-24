import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { UsageManagementClient } from "@/components/admin/usage-management-client";

export const dynamic = "force-dynamic";

export default function UsageManagementPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <UsageManagementClient />
    </FinanceAdminGate>
  );
}
