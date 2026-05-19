import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="p-6">
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Link
          href="/admin/billing/users"
          className="block rounded border border-[#e8e8e8] bg-white p-4 hover:border-[#1890ff] hover:shadow-sm"
        >
          <div className="mb-1 text-base font-medium text-[#262626]">按用户查看账单明细 →</div>
          <div className="text-xs text-[#8c8c8c]">
            列出所有有 ToolBillingDetailLine 的用户；点击进入该用户的 31 列明细。
          </div>
        </Link>
        <Link
          href="/admin/billing/all"
          className="block rounded border border-[#e8e8e8] bg-white p-4 hover:border-[#1890ff] hover:shadow-sm"
        >
          <div className="mb-1 text-base font-medium text-[#262626]">费用明细（全部用户）→</div>
          <div className="text-xs text-[#8c8c8c]">
            汇总展示所有用户的 ToolBillingDetailLine；与「用户明细」同一份组件 / 口径。
          </div>
        </Link>
        <Link
          href="/admin/pricing-disclosure"
          className="block rounded border border-[#e8e8e8] bg-white p-4 hover:border-[#1890ff] hover:shadow-sm"
        >
          <div className="mb-1 text-base font-medium text-[#262626]">价格公示 →</div>
          <div className="text-xs text-[#8c8c8c]">
            与个人中心 / 前台公示页共用同一份「平台价目表」（云挂牌价 × 系数 = 平台单价）。
          </div>
        </Link>
        <Link
          href="/admin/models/coefficients"
          className="block rounded border border-[#e8e8e8] bg-white p-4 hover:border-[#1890ff] hover:shadow-sm"
        >
          <div className="mb-1 text-base font-medium text-[#262626]">模型 / 零售系数 →</div>
          <div className="text-xs text-[#8c8c8c]">
            系数默认 2.0；逐工具 + 逐参考模型独立配置。
          </div>
        </Link>
      </div>
    </div>
  );
}
