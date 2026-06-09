import { BillDetailsClient } from "@/components/bill-details-client";

/**
 * 费用明细汇总（全部用户）。
 *
 * 与"用户明细"同一份组件、同一份口径，差别仅有：
 *   - 调用 `/api/finance/admin/billing-details-all` 拉全部用户；
 *   - 顶部「当前账单归属」等与单一登录用户绑定的块隐藏；
 *   - 头部统计中「钱包余额 / 余额减积分消耗」折叠（无单一目标用户概念），改显「DB 总条数」。
 */
export default function AdminAllBillingDetailsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <h1 className="text-base font-medium text-[#262626]">费用明细 · 全部用户</h1>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          数据来自 book-mall{" "}
          <code className="rounded bg-[#f5f5f5] px-1">/api/finance/admin/billing-details-all</code>
          （需在 book-mall 以管理员登录同一浏览器会话）。汇总当前所有用户的明细。
        </p>
      </header>
      <BillDetailsClient mode="all-users" viewerRole="admin" />
    </div>
  );
}
