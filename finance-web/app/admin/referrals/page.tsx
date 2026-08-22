"use client";

import { ShareRewardConfigPanel } from "@/components/admin/share-reward-config-panel";
import { ReferralsClient } from "@/components/admin/referrals-client";
import { FinanceAdminGate } from "@/components/finance-admin-gate";

export const dynamic = "force-dynamic";

export default function AdminReferralsPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <div className="space-y-6">
        <ShareRewardConfigPanel />
        <ReferralsClient />
      </div>
    </FinanceAdminGate>
  );
}
