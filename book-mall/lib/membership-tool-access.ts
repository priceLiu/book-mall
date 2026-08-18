import { prisma } from "@/lib/prisma";
import { isMembershipServiceActive } from "@/lib/billing/membership-service-period";

export type MembershipToolAccessSource =
  | "personal_plan"
  | "team_plan"
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
 * 工具准入：平台代付积分会员（个人/团队）或可用积分。
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
  return getPlatformCreditToolAccess(userId, now);
}

async function getPlatformCreditToolAccess(
  userId: string,
  now: Date,
): Promise<MembershipToolAccess> {
  const creditAcc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
    select: {
      id: true,
      planId: true,
      monthlyGrantCredits: true,
      membershipPaidUntil: true,
      balanceCredits: true,
    },
  });
  if (creditAcc?.planId && creditAcc.monthlyGrantCredits > 0) {
    const periodOk = isMembershipServiceActive(creditAcc.membershipPaidUntil, now);
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

  // 注册赠送 / 轻量包充值：有可用积分即可进工具站，不要求先买会员订阅。
  const usable = await sumUsableCredits(creditAcc, now);
  if (usable > 0) {
    return { ok: true, planName: "积分可用（赠送/充值）", source: "personal_plan" };
  }

  return { ok: false, planName: null, source: null };
}

/** 账户余额优先；余额为 0 时回退统计未过期批次（修复运维清零后批次未同步）。 */
async function sumUsableCredits(
  creditAcc: {
    id: string;
    balanceCredits: number;
  } | null,
  now: Date,
): Promise<number> {
  if (!creditAcc) return 0;
  if (creditAcc.balanceCredits > 0) return creditAcc.balanceCredits;
  const lots = await prisma.creditLot.findMany({
    where: {
      accountId: creditAcc.id,
      remainingCredits: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { remainingCredits: true },
  });
  return lots.reduce((sum, lot) => sum + lot.remainingCredits, 0);
}

export async function userHasMembershipToolAccess(userId: string): Promise<boolean> {
  const access = await getMembershipToolAccess(userId);
  return access.ok;
}
