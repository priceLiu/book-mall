import { Suspense } from "react";
import { BillingLedgerClient } from "@/components/billing-ledger-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamBillingLedgerPage() {
  return (
    <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
      <BillingLedgerClient scope="team" />
    </Suspense>
  );
}
