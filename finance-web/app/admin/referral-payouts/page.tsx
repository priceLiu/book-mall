import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ReferralPayoutsClient } from "@/components/admin/referral-payouts-client";

export const dynamic = "force-dynamic";

export default function AdminReferralPayoutsPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <ReferralPayoutsClient />
    </FinanceAdminGate>
  );
}
