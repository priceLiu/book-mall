import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import {
  getActiveTenantContext,
  listUserTenantMemberships,
} from "@/lib/tenant/context";
import { getTenantOverview } from "@/lib/tenant/tenant-service";
import { canTenant } from "@/lib/tenant/permission";
import {
  expireStalePendingInvites,
  listInvites,
} from "@/lib/tenant/tenant-invite-service";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "团队空间 — 个人中心",
};

export default async function AccountTeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [memberships, activeCtx, user, teamPlans] = await Promise.all([
    listUserTenantMemberships(userId),
    getActiveTenantContext(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    }),
    prisma.membershipPlan.findMany({
      where: { family: "TEAM", active: true },
      include: { seatTiers: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const teamMemberships = memberships.filter((m) => m.tenantType === "TEAM");
  const selectedTeamId =
    activeCtx?.tenantType === "TEAM"
      ? activeCtx.tenantId
      : teamMemberships[0]?.tenantId ?? null;

  const overview = selectedTeamId
    ? await getTenantOverview(selectedTeamId)
    : null;
  const myMembership = selectedTeamId
    ? memberships.find((m) => m.tenantId === selectedTeamId) ?? null
    : null;
  const myRole = myMembership?.role ?? null;

  const canManageMembers = myRole ? canTenant(myRole, "member:manage") : false;
  const invites =
    selectedTeamId && canManageMembers
      ? await listInvites(selectedTeamId)
      : [];

  if (user?.phone) {
    await expireStalePendingInvites({ phone: user.phone });
  }
  // 收到的待接受邀请（按当前登录手机号）
  const incomingInvites = user?.phone
    ? await prisma.tenantInvite.findMany({
        where: {
          phone: user.phone,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <>
      <AccountSectionHeader
        title="团队空间"
        description="开通团队/公司版，邀请成员、分配席位、共享积分池与资产。主账号可计费与管理 Key；管理员管理成员与公共资产；成员仅使用。"
      />
      <TeamClient
        userId={userId}
        userPhone={user?.phone ?? null}
        memberships={memberships}
        activeTenantId={activeCtx?.tenantId ?? null}
        selectedTeamId={selectedTeamId}
        myRole={myRole}
        overview={
          overview
            ? {
                tenant: {
                  id: overview.tenant.id,
                  name: overview.tenant.name,
                  packageLevel: overview.tenant.packageLevel,
                  interval: overview.tenant.interval,
                  seatLimit: overview.seatLimit,
                  maxConcurrency: overview.tenant.maxConcurrency,
                  perSeatCapCredits: overview.tenant.perSeatCapCredits,
                  currentPeriodEnd:
                    overview.tenant.currentPeriodEnd?.toISOString() ?? null,
                },
                usedSeats: overview.usedSeats,
                balanceCredits: overview.account?.balanceCredits ?? 0,
                monthlyGrantCredits: overview.account?.monthlyGrantCredits ?? 0,
                members: overview.members.map((m) => ({
                  id: m.id,
                  userId: m.userId,
                  name: m.user.name,
                  phone: m.user.phone,
                  image: m.user.image,
                  role: m.role,
                  status: m.status,
                  seatLabel: m.seat?.label ?? null,
                })),
              }
            : null
        }
        invites={invites.map((i) => ({
          id: i.id,
          token: i.token,
          phone: i.phone,
          role: i.role,
          expiresAt: i.expiresAt.toISOString(),
          urlCode: i.urlCode,
        }))}
        incomingInvites={incomingInvites.map((i) => ({
          token: i.token,
          tenantName: i.tenant.name,
          role: i.role,
          urlCode: i.urlCode,
        }))}
        teamPlans={teamPlans.map((p) => ({
          id: p.id,
          tier: p.tier,
          interval: p.interval,
          priceYuan: Number(p.priceYuan),
          monthlyCredits: p.monthlyCredits,
          includedSeats: p.includedSeats,
        }))}
      />
    </>
  );
}
