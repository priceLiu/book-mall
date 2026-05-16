import { FeesHeader } from "@/components/fees-header";

export default function BillingSubscriptionsPage() {
  return (
    <>
      <FeesHeader breadcrumbs={["费用与成本", "账单订阅"]} title="账单订阅" />
      <div className="flex flex-1 items-center justify-center bg-[#f5f5f5] p-8 text-sm text-[#8c8c8c]">
        占位：订阅/资源包与云上「抵扣」维度的说明页。
      </div>
    </>
  );
}
