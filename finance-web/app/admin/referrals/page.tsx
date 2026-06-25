import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ReferralsClient } from "@/components/admin/referrals-client";

export const dynamic = "force-dynamic";

export default function AdminReferralsPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <ReferralsClient />
    </FinanceAdminGate>
  );
}
