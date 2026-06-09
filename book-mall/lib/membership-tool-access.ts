import { prisma } from "@/lib/prisma";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";

export type MembershipToolAccessSource =
  | "personal_plan"
  | "team_plan"
  | "byok_personal"
  | "byok_team"
  | null;

export type MembershipToolAccess = {
  ok: boolean;
  planName: string | null;
  source: MembershipToolAccessSource;
};

/**
 * 工具准入：按 billingPersona 单一路径，禁止混用。
 * PLATFORM_CREDIT → 有效积分会员（个人/团队）
 * BYOK → 有效 BYOK 订阅 + 已关联 Gateway Key
 */
export async function getMembershipToolAccess(
  userId: string,
): Promise<MembershipToolAccess> {
  const now = new Date();
  const persona = await getUserBillingPersona(userId);

  if (persona === "BYOK") {
    return getByokToolAccess(userId, now);
  }

  if (persona === "PLATFORM_CREDIT" || persona === null) {
    return getPlatformCreditToolAccess(userId, now);
  }

  return { ok: false, planName: null, source: null };
}

async function getPlatformCreditToolAccess(
  userId: string,
  now: Date,
): Promise<MembershipToolAccess> {
  const creditAcc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
    select: {
      planId: true,
      monthlyGrantCredits: true,
      currentPeriodEnd: true,
    },
  });
  if (creditAcc?.planId && creditAcc.monthlyGrantCredits > 0) {
    const periodOk =
      !creditAcc.currentPeriodEnd || creditAcc.currentPeriodEnd > now;
    if (periodOk) {
      const plan = await prisma.membershipPlan.findUnique({
        where: { id: creditAcc.planId },
        select: { tier: true, family: true, interval: true },
      });
      const label = plan
        ? `${plan.family === "TEAM" ? "团队" : "个人"} · ${plan.tier}（${plan.interval === "YEAR" ? "年付" : "月付"}）`
        : "会员套餐";
      return { ok: true, planName: label, source: "personal_plan" };
    }
  }

  const teamMember = await prisma.tenantMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      tenant: {
        type: "TEAM",
        status: "ACTIVE",
        planId: { not: null },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
    },
    include: {
      tenant: { select: { name: true, packageLevel: true, interval: true } },
    },
  });
  if (teamMember?.tenant) {
    const t = teamMember.tenant;
    const tier = t.packageLevel ?? "团队套餐";
    const interval = t.interval === "YEAR" ? "年付" : "月付";
    return {
      ok: true,
      planName: `${t.name} · ${tier}（${interval}）`,
      source: "team_plan",
    };
  }

  return { ok: false, planName: null, source: null };
}

async function getByokToolAccess(
  userId: string,
  now: Date,
): Promise<MembershipToolAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gatewayApiKeyId: true },
  });
  if (!user?.gatewayApiKeyId) {
    return { ok: false, planName: null, source: null };
  }

  const personalByok = await prisma.byokSubscription.findFirst({
    where: {
      ownerType: "USER",
      ownerId: userId,
      status: "ACTIVE",
      periodEnd: { gt: now },
    },
    orderBy: { periodEnd: "desc" },
  });
  if (personalByok) {
    const cfg = await prisma.byokServiceConfig.findUnique({
      where: { scopeKey: personalByok.scopeKey },
      select: { label: true },
    });
    return {
      ok: true,
      planName: cfg?.label ?? "个人 BYOK",
      source: "byok_personal",
    };
  }

  const teamMemberships = await prisma.tenantMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
      tenant: { type: "TEAM", status: "ACTIVE" },
    },
    select: { tenantId: true, tenant: { select: { name: true } } },
  });
  if (teamMemberships.length > 0) {
    const teamIds = teamMemberships.map((m) => m.tenantId);
    const teamByok = await prisma.byokSubscription.findFirst({
      where: {
        ownerType: "TENANT",
        ownerId: { in: teamIds },
        status: "ACTIVE",
        periodEnd: { gt: now },
      },
      orderBy: { periodEnd: "desc" },
    });
    if (teamByok) {
      const tenantName =
        teamMemberships.find((m) => m.tenantId === teamByok.ownerId)?.tenant.name ??
        "团队";
      const cfg = await prisma.byokServiceConfig.findUnique({
        where: { scopeKey: teamByok.scopeKey },
        select: { label: true },
      });
      return {
        ok: true,
        planName: `${tenantName} · ${cfg?.label ?? "团队 BYOK"}`,
        source: "byok_team",
      };
    }
  }

  return { ok: false, planName: null, source: null };
}

export async function userHasMembershipToolAccess(userId: string): Promise<boolean> {
  const access = await getMembershipToolAccess(userId);
  return access.ok;
}
