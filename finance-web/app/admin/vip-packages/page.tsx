import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { VipPackagesClient } from "@/components/admin/vip-packages-client";

export const dynamic = "force-dynamic";

export default function AdminVipPackagesPage() {
  return (
    <FinanceAdminGate require="managePricing">
      <VipPackagesClient />
    </FinanceAdminGate>
  );
}
