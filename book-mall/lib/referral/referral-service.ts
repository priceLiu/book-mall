import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isMembershipServiceActive } from "@/lib/billing/membership-service-period";

/**
 * 分享返佣 · 领域服务（分享链接 1.0）
 *
 * 门禁（谁能生成分享链接）：
 *   - 任意有效订阅均可：个人套餐（PERSONAL，任意档）或团队 OWNER（团队套餐有效）。
 *   - 团队非 OWNER 成员（ADMIN / MEMBER）严格排除：即便其另有个人订阅也不给。
 *
 * 返佣比例（commissionRate）不在代码写死；新建档案用财务可调的默认比例
 * （PlatformPricingConfig.referralDefaultRate，缺省 0.05 ≈ 保 20% 毛利），
 * 后续可由财务管理员在后台逐个分享人调整。
 */

/** 分享返佣默认比例回退值（DB 无配置时使用；0.05 ≈ 对全部产品保 20% 毛利）。 */
export const REFERRAL_DEFAULT_RATE_FALLBACK = 0.05;

/** 计入「套餐金额」的订单类型（会员/订阅类） */
const PLAN_ORDER_TYPES: Prisma.OrderWhereInput["type"] = {
  in: ["SUBSCRIPTION", "MEMBERSHIP", "PRODUCT_SUBSCRIPTION", "BYOK_SERVICE_FEE"],
};
/** 计入「充值金额」的订单类型（钱包/积分充值类） */
const RECHARGE_ORDER_TYPES: Prisma.OrderWhereInput["type"] = {
  in: ["WALLET_TOPUP", "CREDIT_TOPUP"],
};

export type ReferralEligibility = {
  eligible: boolean;
  planLabel: string | null;
  reason: string | null;
};

/**
 * 判定某用户是否满足分享门禁（分享链接 1.0）：
 *   1. 团队非 OWNER 成员（ACTIVE 的 ADMIN/MEMBER，团队 ACTIVE）→ 严格排除（优先级最高）。
 *   2. 有效个人套餐（任意档）→ 合格。
 *   3. 团队 OWNER 且团队套餐有效 → 合格。
 */
export async function getReferralEligibility(
  userId: string,
): Promise<ReferralEligibility> {
  const now = new Date();

  // 1) 团队非 OWNER 成员：硬排除（即便其自有个人订阅）。
  const teamNonOwner = await prisma.tenantMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      role: { in: ["ADMIN", "MEMBER"] },
      tenant: { type: "TEAM", status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (teamNonOwner) {
    return { eligible: false, planLabel: null, reason: "团队成员不可分享" };
  }

  // 2) 有效个人套餐（任意档，已取消 ¥599/¥1490 门槛）。
  const acc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
    select: { planId: true, monthlyGrantCredits: true, membershipPaidUntil: true },
  });
  if (acc?.planId && acc.monthlyGrantCredits > 0) {
    const periodOk = isMembershipServiceActive(acc.membershipPaidUntil, now);
    if (periodOk) {
      const plan = await prisma.membershipPlan.findUnique({
        where: { id: acc.planId },
        select: { family: true, interval: true, tier: true },
      });
      if (plan?.family === "PERSONAL") {
        const planLabel = `个人 · ${plan.tier}（${plan.interval === "YEAR" ? "年付" : "月付"}）`;
        return { eligible: true, planLabel, reason: null };
      }
    }
  }

  // 3) 团队 OWNER 且团队套餐有效。
  const ownerMembership = await prisma.tenantMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      role: "OWNER",
      tenant: {
        type: "TEAM",
        status: "ACTIVE",
        planId: { not: null },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
    },
    select: { tenant: { select: { name: true, packageLevel: true, interval: true } } },
  });
  if (ownerMembership?.tenant) {
    const t = ownerMembership.tenant;
    const intervalLabel = t.interval === "YEAR" ? "年付" : "月付";
    const planLabel = `团队 · ${t.name}${t.packageLevel ? `（${t.packageLevel} · ${intervalLabel}）` : ""}`;
    return { eligible: true, planLabel, reason: null };
  }

  return { eligible: false, planLabel: null, reason: "无有效订阅" };
}

/** 读取分享返佣默认比例（财务可在 PlatformPricingConfig 调；缺省 0.05）。 */
export async function getReferralDefaultRate(): Promise<number> {
  try {
    const cfg = await prisma.platformPricingConfig.findUnique({
      where: { id: "default" },
      select: { referralDefaultRate: true },
    });
    const rate = cfg ? Number(cfg.referralDefaultRate) : REFERRAL_DEFAULT_RATE_FALLBACK;
    return Number.isFinite(rate) && rate >= 0 && rate <= 1
      ? rate
      : REFERRAL_DEFAULT_RATE_FALLBACK;
  } catch {
    // 迁移尚未应用（列缺失）等场景：回退默认，不阻断分享档案创建。
    return REFERRAL_DEFAULT_RATE_FALLBACK;
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆 I O 0 1
const CODE_LENGTH = 8;

function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export type EnsureReferralProfileResult =
  | { ok: true; code: string; commissionRate: number; enabled: boolean }
  | { ok: false; reason: string };

/**
 * 获取或创建当前用户的分享档案。
 * 仅对满足门禁的用户创建；已存在档案则直接返回（即便后续降级也保留）。
 */
export async function ensureReferralProfile(
  userId: string,
): Promise<EnsureReferralProfileResult> {
  const existing = await prisma.referralProfile.findUnique({
    where: { referrerUserId: userId },
    select: { code: true, commissionRate: true, enabled: true },
  });
  if (existing) {
    return {
      ok: true,
      code: existing.code,
      commissionRate: Number(existing.commissionRate),
      enabled: existing.enabled,
    };
  }

  const elig = await getReferralEligibility(userId);
  if (!elig.eligible) {
    return { ok: false, reason: elig.reason ?? "不满足分享门禁" };
  }

  const defaultRate = await getReferralDefaultRate();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateReferralCode();
    try {
      const created = await prisma.referralProfile.create({
        data: { referrerUserId: userId, code, commissionRate: defaultRate },
        select: { code: true, commissionRate: true, enabled: true },
      });
      return {
        ok: true,
        code: created.code,
        commissionRate: Number(created.commissionRate),
        enabled: created.enabled,
      };
    } catch (err) {
      // 唯一约束冲突（code 或 referrerUserId）→ 重试 / 回查
      const e = err as { code?: string };
      if (e?.code === "P2002") {
        const again = await prisma.referralProfile.findUnique({
          where: { referrerUserId: userId },
          select: { code: true, commissionRate: true, enabled: true },
        });
        if (again) {
          return {
            ok: true,
            code: again.code,
            commissionRate: Number(again.commissionRate),
            enabled: again.enabled,
          };
        }
        continue; // code 撞码，换一个再试
      }
      throw err;
    }
  }
  return { ok: false, reason: "生成分享码失败，请重试" };
}

export type ResolvedReferrer = {
  referrerUserId: string;
  referrerName: string | null;
  code: string;
};

/** 通过分享码解析上线用户（仅启用中的分享码）。 */
export async function resolveReferrerByCode(
  code: string,
): Promise<ResolvedReferrer | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const profile = await prisma.referralProfile.findUnique({
    where: { code: normalized },
    select: { referrerUserId: true, enabled: true, referrer: { select: { name: true } } },
  });
  if (!profile || !profile.enabled) return null;
  return {
    referrerUserId: profile.referrerUserId,
    referrerName: profile.referrer?.name ?? null,
    code: normalized,
  };
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/(\d{3})\d{4}(\d{2,4})/, "$1****$2");
}

export type ReferredUserRow = {
  userId: string;
  name: string | null;
  phoneMasked: string;
  joinedAt: Date;
  planAmountYuan: number;
  rechargeAmountYuan: number;
};

export type ReferralDashboard = {
  code: string;
  enabled: boolean;
  commissionRate: number; // 0~1
  shareUrl: string;
  referredCount: number;
  totalPlanAmountYuan: number;
  totalRechargeAmountYuan: number;
  totalAmountYuan: number;
  estimatedCommissionYuan: number; // total * rate（未设比例时为 0）
  rows: ReferredUserRow[];
};

async function sumOrdersByUser(
  userIds: string[],
  typeFilter: Prisma.OrderWhereInput["type"],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;
  const agg = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: "PAID", type: typeFilter },
    _sum: { amountYuan: true },
  });
  for (const row of agg) {
    map.set(row.userId, Number(row._sum.amountYuan ?? 0));
  }
  return map;
}

/** 个人中心：分享人查看自己邀请的用户及金额。 */
export async function getReferralDashboard(
  userId: string,
  shareBaseUrl: string,
): Promise<ReferralDashboard | null> {
  const profile = await prisma.referralProfile.findUnique({
    where: { referrerUserId: userId },
    select: { code: true, enabled: true, commissionRate: true },
  });
  if (!profile) return null;

  const referred = await prisma.user.findMany({
    where: { referredByUserId: userId },
    select: { id: true, name: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const ids = referred.map((u) => u.id);
  const [planMap, rechargeMap] = await Promise.all([
    sumOrdersByUser(ids, PLAN_ORDER_TYPES),
    sumOrdersByUser(ids, RECHARGE_ORDER_TYPES),
  ]);

  const rows: ReferredUserRow[] = referred.map((u) => ({
    userId: u.id,
    name: u.name,
    phoneMasked: maskPhone(u.phone),
    joinedAt: u.createdAt,
    planAmountYuan: planMap.get(u.id) ?? 0,
    rechargeAmountYuan: rechargeMap.get(u.id) ?? 0,
  }));

  const totalPlanAmountYuan = rows.reduce((s, r) => s + r.planAmountYuan, 0);
  const totalRechargeAmountYuan = rows.reduce(
    (s, r) => s + r.rechargeAmountYuan,
    0,
  );
  const totalAmountYuan = totalPlanAmountYuan + totalRechargeAmountYuan;
  const commissionRate = Number(profile.commissionRate);

  return {
    code: profile.code,
    enabled: profile.enabled,
    commissionRate,
    shareUrl: `${shareBaseUrl.replace(/\/$/, "")}/r/${profile.code}`,
    referredCount: rows.length,
    totalPlanAmountYuan,
    totalRechargeAmountYuan,
    totalAmountYuan,
    estimatedCommissionYuan: Math.round(totalAmountYuan * commissionRate * 100) / 100,
    rows,
  };
}

// —— 财务后台 —————————————————————————————————————————————

export type ReferralAdminRow = {
  referrerUserId: string;
  referrerName: string | null;
  referrerPhoneMasked: string;
  code: string;
  enabled: boolean;
  commissionRate: number;
  referredCount: number;
  totalPlanAmountYuan: number;
  totalRechargeAmountYuan: number;
  totalAmountYuan: number;
  estimatedCommissionYuan: number;
  note: string | null;
  rateUpdatedAt: Date | null;
  rateUpdatedBy: string | null;
  createdAt: Date;
};

/** 财务后台：全部分享人概览（含下线数量、套餐/充值金额、按比例预估返佣）。 */
export async function listReferralAdminOverview(): Promise<ReferralAdminRow[]> {
  const profiles = await prisma.referralProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      referrerUserId: true,
      code: true,
      enabled: true,
      commissionRate: true,
      note: true,
      rateUpdatedAt: true,
      rateUpdatedBy: true,
      createdAt: true,
      referrer: { select: { name: true, phone: true } },
    },
  });
  if (profiles.length === 0) return [];

  const referrerIds = profiles.map((p) => p.referrerUserId);
  const referred = await prisma.user.findMany({
    where: { referredByUserId: { in: referrerIds } },
    select: { id: true, referredByUserId: true },
  });

  const referrerToUsers = new Map<string, string[]>();
  for (const u of referred) {
    if (!u.referredByUserId) continue;
    const arr = referrerToUsers.get(u.referredByUserId) ?? [];
    arr.push(u.id);
    referrerToUsers.set(u.referredByUserId, arr);
  }

  const allReferredIds = referred.map((u) => u.id);
  const [planMap, rechargeMap] = await Promise.all([
    sumOrdersByUser(allReferredIds, PLAN_ORDER_TYPES),
    sumOrdersByUser(allReferredIds, RECHARGE_ORDER_TYPES),
  ]);

  return profiles.map((p) => {
    const ids = referrerToUsers.get(p.referrerUserId) ?? [];
    const totalPlanAmountYuan = ids.reduce((s, id) => s + (planMap.get(id) ?? 0), 0);
    const totalRechargeAmountYuan = ids.reduce(
      (s, id) => s + (rechargeMap.get(id) ?? 0),
      0,
    );
    const totalAmountYuan = totalPlanAmountYuan + totalRechargeAmountYuan;
    const commissionRate = Number(p.commissionRate);
    return {
      referrerUserId: p.referrerUserId,
      referrerName: p.referrer?.name ?? null,
      referrerPhoneMasked: maskPhone(p.referrer?.phone),
      code: p.code,
      enabled: p.enabled,
      commissionRate,
      referredCount: ids.length,
      totalPlanAmountYuan,
      totalRechargeAmountYuan,
      totalAmountYuan,
      estimatedCommissionYuan:
        Math.round(totalAmountYuan * commissionRate * 100) / 100,
      note: p.note,
      rateUpdatedAt: p.rateUpdatedAt,
      rateUpdatedBy: p.rateUpdatedBy,
      createdAt: p.createdAt,
    };
  });
}

export type SetCommissionRateResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * 财务管理员录入某分享人的返佣比例（rate 为 0~1 小数）。
 * 可同时停用/启用分享码与备注。
 */
export async function setReferralCommissionRate(params: {
  referrerUserId: string;
  rate: number;
  adminUserId: string;
  note?: string | null;
  enabled?: boolean;
}): Promise<SetCommissionRateResult> {
  const { referrerUserId, rate, adminUserId, note, enabled } = params;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    return { ok: false, reason: "返佣比例需为 0~1 的小数（如 0.1 = 10%）" };
  }
  const profile = await prisma.referralProfile.findUnique({
    where: { referrerUserId },
    select: { id: true },
  });
  if (!profile) return { ok: false, reason: "分享人档案不存在" };

  await prisma.referralProfile.update({
    where: { referrerUserId },
    data: {
      commissionRate: rate,
      rateUpdatedAt: new Date(),
      rateUpdatedBy: adminUserId,
      ...(note !== undefined ? { note } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  });
  return { ok: true };
}
