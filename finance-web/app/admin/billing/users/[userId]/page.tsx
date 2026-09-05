import { BillDetailsClient } from "@/components/bill-details-client";
import { FinancePageBleed } from "@/components/finance-page-shell";

type Props = { params: { userId: string } };

export default function AdminUserBillingPage({ params }: Props) {
  const isAssistant = params.userId === "platform-assistant";
  return (
    <FinancePageBleed>
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <h1 className="text-base font-medium text-[#262626]">
          {isAssistant ? "AI 小智 · 平台用量明细" : `用户明细 · ${params.userId}`}
        </h1>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          {isAssistant
            ? "平台导览助手（对话 / 资讯生成 / RAG 向量）专用对帐视图；不计入用户个人积分。"
            : "数据来自 book-mall /api/finance/admin/billing-details（含账期 Token 汇总；请先在 book-mall 以管理员登录同一浏览器会话）。"}
        </p>
      </header>
      <BillDetailsClient adminTargetUserId={params.userId} viewerRole="admin" />
    </FinancePageBleed>
  );
}
