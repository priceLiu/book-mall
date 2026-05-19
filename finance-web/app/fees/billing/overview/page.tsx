import { FeesHeader } from "@/components/fees-header";

export default function BillingOverviewPage() {
  return (
    <>
      <FeesHeader title="账单概览" />
      <div className="flex flex-1 items-center justify-center bg-[#f0f2f5] p-8 text-sm text-[#8c8c8c]">
        占位：后续接聚合图表与周期汇总（与 0516 §8 统计口径一致）。
      </div>
    </>
  );
}
