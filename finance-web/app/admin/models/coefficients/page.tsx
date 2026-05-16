import { RETAIL_MULTIPLIER_DEFAULT } from "@/lib/bill-config";

export default function AdminModelCoefficientsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-medium text-[#262626]">模型与零售系数（静态）</h1>
      <div className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#fafafa] text-left text-[#595959]">
              <th className="border border-[#e8e8e8] px-3 py-2">策略</th>
              <th className="border border-[#e8e8e8] px-3 py-2">说明</th>
              <th className="border border-[#e8e8e8] px-3 py-2">零售系数 M</th>
              <th className="border border-[#e8e8e8] px-3 py-2">校验</th>
            </tr>
          </thead>
          <tbody className="text-[#262626]">
            <tr>
              <td className="border border-[#e8e8e8] px-3 py-2">方案 A 默认</td>
              <td className="border border-[#e8e8e8] px-3 py-2">
                我方单价（元/单位）= 云有效成本单价 × M；扣点 ≈ round(单价×用量×100)（演示口径，与 book-mall 对齐时再收紧）。
              </td>
              <td className="border border-[#e8e8e8] px-3 py-2 font-mono">{RETAIL_MULTIPLIER_DEFAULT}</td>
              <td className="border border-[#e8e8e8] px-3 py-2">
                <code className="text-xs">pnpm pricing:verify-billable-formula</code>
              </td>
            </tr>
            <tr>
              <td className="border border-[#e8e8e8] px-3 py-2">按模型覆写</td>
              <td className="border border-[#e8e8e8] px-3 py-2">
                占位：后续从 <code className="rounded bg-[#f5f5f5] px-1">ToolBillablePrice.schemeAAdminRetailMultiplier</code>{" "}
                读取。
              </td>
              <td className="border border-[#e8e8e8] px-3 py-2">—</td>
              <td className="border border-[#e8e8e8] px-3 py-2">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
