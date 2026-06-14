"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BillDetailsClient } from "@/components/bill-details-client";
import { BillingLedgerClient } from "@/components/billing-ledger-client";
import { TeamUsageClient } from "@/components/team-usage-client";
import { FinancePageBleed } from "@/components/finance-page-shell";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "details", label: "费用明细" },
  { id: "ledger", label: "积分流水" },
  { id: "usage", label: "积分用量" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TeamMemberDetailClient({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId") ?? undefined;
  const [tab, setTab] = useState<TabId>("details");
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

  return (
    <FinancePageBleed>
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <Link href={`/team/members${qs}`} className="text-sm text-[#1890ff] hover:underline">
          ← 返回成员分账
        </Link>
        <h1 className="mt-2 text-base font-medium text-[#262626]">成员财务明细</h1>
        <p className="mt-1 font-mono text-xs text-[#8c8c8c]">{userId}</p>
        <nav className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded px-3 py-1.5 text-sm",
                tab === t.id ? "bg-[#1890ff] text-white" : "border border-[#d9d9d9] text-[#595959]",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {tab === "details" ? (
        <BillDetailsClient teamScope teamTenantId={tenantId} teamActorUserId={userId} viewerRole="user" />
      ) : null}
      {tab === "ledger" ? (
        <div className="p-4">
          <BillingLedgerClient scope="team" tenantId={tenantId} actorUserId={userId} />
        </div>
      ) : null}
      {tab === "usage" ? (
        <TeamUsageClient memberUserId={userId} />
      ) : null}
    </FinancePageBleed>
  );
}
