import { FeesHeader } from "@/components/fees-header";

export default function BillingOverviewPage() {
  return (
    <>
      <FeesHeader breadcrumbs={["费用与成本", "账单概览"]} title="账单概览" />
      <div className="flex flex-1 items-center justify-center bg-[#f5f5f5] p-8 text-sm text-[#8c8c8c]">
        占位：后续接聚合图表与周期汇总（与 0516 §8 管理端统计一致）。
      </div>
    </>
  );
}
