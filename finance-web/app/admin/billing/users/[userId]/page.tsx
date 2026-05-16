import { BillDetailsClient } from "@/components/bill-details-client";

type Props = { params: { userId: string } };

export default function AdminUserBillingPage({ params }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <h1 className="text-base font-medium text-[#262626]">用户明细 · {params.userId}</h1>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          数据来自 book-mall{" "}
          <code className="rounded bg-[#f5f5f5] px-1">/api/admin/finance/billing-detail-lines</code>
          （请先在 book-mall 以管理员登录同一浏览器会话）。
        </p>
      </header>
      <BillDetailsClient adminTargetUserId={params.userId} viewerRole="admin" />
    </div>
  );
}
