import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { VipOpsClient } from "@/components/admin/vip-ops-client";

export const dynamic = "force-dynamic";

export default function AdminVipOpsPage() {
  return (
    <FinanceAdminGate require="managePricing">
      <VipOpsClient />
    </FinanceAdminGate>
  );
}
