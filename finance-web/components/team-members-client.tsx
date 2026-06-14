"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type MemberRow = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  seatLabel: string | null;
  monthlyCapCredits: number | null;
  consumed: number;
  count: number;
};

type MembersResponse = {
  hasTeam: boolean;
  tenantId?: string;
  tenantName?: string;
  periodKey: string;
  members: MemberRow[];
  perSeatCapCredits: number | null;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "主账号",
  ADMIN: "管理员",
  MEMBER: "成员",
};

function fmt(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

export function TeamMembersClient() {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!base) return;
    const tenantId = searchParams.get("tenantId");
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    financeApiFetch<MembersResponse>(base, `/api/finance/team/members${qs}`).then((r) =>
      r.ok ? setData(r.data) : setError(r.error),
    );
  }, [base, searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  if (!data.hasTeam) {
    return (
      <FinancePageShell>
        <h1 className="text-lg font-medium">成员分账</h1>
        <p className="text-sm text-[#8c8c8c]">您尚未加入任何团队空间。</p>
      </FinancePageShell>
    );
  }

  const qsTenant = data.tenantId ? `tenantId=${data.tenantId}` : "";

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">成员分账 · {data.tenantName}</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">账期 {data.periodKey} · 按消耗积分排序</p>
        </div>
      </header>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[#fafafa] text-left text-[#595959]">
              <th className="border border-[#e8e8e8] px-3 py-2">成员</th>
              <th className="border border-[#e8e8e8] px-3 py-2">角色</th>
              <th className="border border-[#e8e8e8] px-3 py-2">席位</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">本月消耗</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">次数</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">人均上限</th>
              <th className="border border-[#e8e8e8] px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.userId} className="hover:bg-[#fafafa]">
                <td className="border border-[#e8e8e8] px-3 py-2">
                  <div className="font-medium">{m.name || "—"}</div>
                  <div className="text-xs text-[#8c8c8c]">{m.email}</div>
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2">{ROLE_LABEL[m.role] ?? m.role}</td>
                <td className="border border-[#e8e8e8] px-3 py-2">{m.seatLabel ?? "—"}</td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">{fmt(m.consumed)}</td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right">{m.count}</td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right">
                  {m.monthlyCapCredits != null ? fmt(m.monthlyCapCredits) : "—"}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2">
                  <Link
                    href={`/team/members/${m.userId}?${qsTenant}`}
                    className="text-[#1890ff] hover:underline"
                  >
                    查看明细
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </FinancePageShell>
  );
}
