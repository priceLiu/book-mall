import { Suspense } from "react";
import { BillingByokClient } from "@/components/billing-byok-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamBillingByokPage() {
  return (
    <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
      <BillingByokClient scope="team" />
    </Suspense>
  );
}
