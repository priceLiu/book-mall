import { Suspense } from "react";
import { TeamBillingFinanceClient } from "@/components/team-billing-finance-client";

export const dynamic = "force-dynamic";

export default function TeamBillingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>}>
      <TeamBillingFinanceClient />
    </Suspense>
  );
}
