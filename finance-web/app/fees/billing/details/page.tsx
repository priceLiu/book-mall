import { FeesHeader } from "@/components/fees-header";
import { BillDetailsClient } from "@/components/bill-details-client";
import { FinancePageBleed } from "@/components/finance-page-shell";

export default function BillingDetailsPage() {
  return (
    <FinancePageBleed>
      <FeesHeader />
      <BillDetailsClient />
    </FinancePageBleed>
  );
}
