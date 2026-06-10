import { FeesHeader } from "@/components/fees-header";
import { FinancePageBleed, FinancePageShell } from "@/components/finance-page-shell";

export default function BillingSubscriptionsPage() {
  return (
    <FinancePageBleed>
      <FeesHeader title="账单订阅" />
      <FinancePageShell className="flex-1 justify-center text-sm text-[#8c8c8c]">
        占位：订阅/资源包与云上「抵扣」维度的说明页。
      </FinancePageShell>
    </FinancePageBleed>
  );
}
