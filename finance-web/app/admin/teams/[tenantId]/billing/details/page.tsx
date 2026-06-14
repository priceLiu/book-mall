import { Suspense } from "react";
import Link from "next/link";
import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { AdminTeamBillingDetailsClient } from "@/components/admin/admin-team-billing-details-client";
import { FinancePageBleed, FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function AdminTeamBillingDetailsPage({
  params,
}: {
  params: { tenantId: string };
}) {
  return (
    <FinanceAdminGate require="viewCost">
      <FinancePageBleed>
        <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
          <Link
            href={`/admin/teams/${params.tenantId}`}
            className="text-sm text-[#1890ff] hover:underline"
          >
            ← 团队详情
          </Link>
          <h1 className="mt-2 text-base font-medium text-[#262626]">团队费用明细（管理端）</h1>
        </header>
        <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
          <AdminTeamBillingDetailsClient tenantId={params.tenantId} />
        </Suspense>
      </FinancePageBleed>
    </FinanceAdminGate>
  );
}
