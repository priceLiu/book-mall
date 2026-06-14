import { Suspense } from "react";
import { TeamBillingDetailsClient } from "@/components/team-billing-details-client";
import { FinancePageBleed, FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamBillingDetailsPage() {
  return (
    <FinancePageBleed>
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <h1 className="text-base font-medium text-[#262626]">团队费用明细</h1>
        <p className="mt-1 text-xs text-[#8c8c8c]">团队全员 Gateway 调用明细（OWNER/ADMIN）</p>
      </header>
      <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
        <TeamBillingDetailsClient />
      </Suspense>
    </FinancePageBleed>
  );
}
