import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import {
  getActiveTenantContext,
  listUserTenantMemberships,
} from "@/lib/tenant/context";
import { getTenant } from "@/lib/tenant/tenant-service";
import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { TeamBillingClient } from "./team-billing-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "团队账单 — 个人中心",
};

/** 近 N 个月的 periodKey（UTC，YYYY-MM）。 */
function recentPeriodKeys(count = 6): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function TeamBillingPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [memberships, activeCtx] = await Promise.all([
    listUserTenantMemberships(userId),
    getActiveTenantContext(userId),
  ]);

  const teamMemberships = memberships.filter((m) => m.tenantType === "TEAM");
  const selectedTeamId =
    activeCtx?.tenantType === "TEAM"
      ? activeCtx.tenantId
      : teamMemberships[0]?.tenantId ?? null;

  const myMembership = selectedTeamId
    ? memberships.find((m) => m.tenantId === selectedTeamId) ?? null
    : null;
  const canView = myMembership?.role === "OWNER" || myMembership?.role === "ADMIN";

  const periods = recentPeriodKeys(6);
  const period =
    searchParams.period && periods.includes(searchParams.period)
      ? searchParams.period
      : periods[0];

  const tenant = selectedTeamId ? await getTenant(selectedTeamId) : null;
  const bill =
    selectedTeamId && canView
      ? await buildTeamCreditBill({ tenantId: selectedTeamId, periodKey: period })
      : null;

  return (
    <>
      <AccountSectionHeader
        title="团队账单"
        description="团队共享积分池总账（发放 / 消耗 / 返还 / 充值），按模型与成员下钻，支持 CSV 导出。仅主账号与管理员可见。"
      />
      <TeamBillingClient
        hasTeam={!!selectedTeamId}
        canView={canView}
        tenantName={tenant?.name ?? null}
        period={period}
        periods={periods}
        bill={bill}
      />
    </>
  );
}
