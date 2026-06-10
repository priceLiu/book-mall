import { Suspense } from "react";
import { TeamBillingFinanceClient } from "@/components/team-billing-finance-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamBillingPage() {
  return (
    <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
      <TeamBillingFinanceClient />
    </Suspense>
  );
}
