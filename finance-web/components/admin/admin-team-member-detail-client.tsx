"use client";

import Link from "next/link";
import { BillDetailsClient } from "@/components/bill-details-client";
import { FinancePageBleed } from "@/components/finance-page-shell";

export function AdminTeamMemberDetailClient({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  return (
    <FinancePageBleed>
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <Link href={`/admin/teams/${tenantId}`} className="text-sm text-[#1890ff] hover:underline">
          ← 团队详情
        </Link>
        <h1 className="mt-2 text-base font-medium text-[#262626]">成员溯源</h1>
        <p className="mt-1 font-mono text-xs text-[#8c8c8c]">{userId}</p>
      </header>
      <BillDetailsClient adminTeamTenantId={tenantId} teamActorUserId={userId} viewerRole="admin" />
    </FinancePageBleed>
  );
}
