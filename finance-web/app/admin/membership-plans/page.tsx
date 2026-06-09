import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { MembershipPlansClient } from "@/components/admin/membership-plans-client";

export const dynamic = "force-dynamic";

export default function MembershipPlansPage() {
  return (
    <FinanceAdminGate require="managePricing">
      <MembershipPlansClient />
    </FinanceAdminGate>
  );
}
