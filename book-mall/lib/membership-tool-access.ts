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
 * 准入校验热路径缓存（introspect / 每次 Gateway 调用都会查）：
 * 短 TTL 进程内缓存，避免高并发下每请求多条 user/creditAccount/tenant 查询
 * 抢占有限连接池（如 limit=4）导致整体卡死。订阅变更后最多 TTL 秒延迟生效，可接受。
 */
const ACCESS_CACHE_TTL_MS = 15_000;
const accessCache = new Map<string, { value: MembershipToolAccess; expiresAt: number }>();

/** 订阅/套餐变更后可调用以立即失效（如支付回调、关联 Key 后）。 */
export function invalidateMembershipToolAccessCache(userId?: string): void {
  if (userId) accessCache.delete(userId);
  else accessCache.clear();
}

/**
 * 工具准入：按 billingPersona 单一路径，禁止混用。
 * PLATFORM_CREDIT → 有效积分会员（个人/团队）
 * BYOK → 有效 BYOK 订阅 + 已关联 Gateway Key
 */
export async function getMembershipToolAccess(
  userId: string,
): Promise<MembershipToolAccess> {
  const nowMs = Date.now();
  const cached = accessCache.get(userId);
  if (cached && cached.expiresAt > nowMs) return cached.value;

  const value = await computeMembershipToolAccess(userId);
  accessCache.set(userId, { value, expiresAt: nowMs + ACCESS_CACHE_TTL_MS });
  return value;
}

async function computeMembershipToolAccess(
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

  // 积分换算 1.0：BYOK 准入 = 有效会员订阅 + Gateway Key（不再单独收技术服务费）
  const creditAcc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
    select: { planId: true, currentPeriodEnd: true },
  });
  if (creditAcc?.planId) {
    const periodOk =
      !creditAcc.currentPeriodEnd || creditAcc.currentPeriodEnd > now;
    if (periodOk) {
      const plan = await prisma.membershipPlan.findUnique({
        where: { id: creditAcc.planId },
        select: { tier: true, family: true, interval: true },
      });
      const label = plan
        ? `${plan.family === "TEAM" ? "团队" : "个人"} · ${plan.tier}（${plan.interval === "YEAR" ? "年付" : "月付"}）`
        : "会员订阅";
      return { ok: true, planName: `${label} · 自带 Key`, source: "byok_personal" };
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
    include: { tenant: { select: { name: true, packageLevel: true, interval: true } } },
  });
  if (teamMember?.tenant) {
    const t = teamMember.tenant;
    const tier = t.packageLevel ?? "团队套餐";
    const interval = t.interval === "YEAR" ? "年付" : "月付";
    return {
      ok: true,
      planName: `${t.name} · ${tier}（${interval}）· 自带 Key`,
      source: "byok_team",
    };
  }

  // 兼容历史 BYOK 技术服务费订阅（只读过渡，不再新开）
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
    return { ok: true, planName: "历史 BYOK 套餐", source: "byok_personal" };
  }

  return { ok: false, planName: null, source: null };
}

export async function userHasMembershipToolAccess(userId: string): Promise<boolean> {
  const access = await getMembershipToolAccess(userId);
  return access.ok;
}
