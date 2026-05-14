import { prisma } from "@/lib/prisma";

/** 将 UNUSED 且已过期的券标记为 EXPIRED，返回更新条数 */
export async function expireStaleRechargeCouponsNow(): Promise<number> {
  const r = await prisma.userRechargeCoupon.updateMany({
    where: {
      status: "UNUSED",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return r.count;
}

export async function claimRechargeCoupon(userId: string, templateId: string) {
  await expireStaleRechargeCouponsNow();
  const template = await prisma.rechargePromoTemplate.findFirst({
    where: { id: templateId, active: true },
  });
  if (!template) throw new Error("活动不存在或已下架");

  const now = new Date();
  if (now < template.claimableFrom || now > template.claimableTo) {
    throw new Error("当前不在该优惠券的领取时间内");
  }

  const claimed = await prisma.userRechargeCoupon.count({
    where: { userId, templateId },
  });
  if (claimed >= template.maxClaimsPerUser) {
    throw new Error("您已达到该活动的领取上限");
  }

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + template.validDaysAfterClaim);

  return prisma.userRechargeCoupon.create({
    data: {
      userId,
      templateId,
      paidAmountPointsSnap: template.paidAmountPoints,
      bonusPointsSnap: template.bonusPoints,
      titleSnap: template.title,
      templateSlugSnap: template.slug,
      claimedAt: now,
      expiresAt,
    },
  });
}

export type ClaimableTemplateRow = {
  id: string;
  slug: string;
  title: string;
  paidAmountPoints: number;
  bonusPoints: number;
  claimableFrom: Date;
  claimableTo: Date;
  validDaysAfterClaim: number;
  userClaimedCount: number;
  maxClaimsPerUser: number;
};

/** 当前可展示给用户的「可领取」模板（含是否已达领取上限） */
export async function listClaimableRechargeTemplatesForUser(
  userId: string,
): Promise<ClaimableTemplateRow[]> {
  await expireStaleRechargeCouponsNow();
  const now = new Date();
  const templates = await prisma.rechargePromoTemplate.findMany({
    where: {
      active: true,
      claimableFrom: { lte: now },
      claimableTo: { gte: now },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const out: ClaimableTemplateRow[] = [];
  for (const t of templates) {
    const userClaimedCount = await prisma.userRechargeCoupon.count({
      where: { userId, templateId: t.id },
    });
    out.push({
      id: t.id,
      slug: t.slug,
      title: t.title,
      paidAmountPoints: t.paidAmountPoints,
      bonusPoints: t.bonusPoints,
      claimableFrom: t.claimableFrom,
      claimableTo: t.claimableTo,
      validDaysAfterClaim: t.validDaysAfterClaim,
      userClaimedCount,
      maxClaimsPerUser: t.maxClaimsPerUser,
    });
  }
  return out;
}

/** 用户未核销、未过期且与充值档位一致的券（用于收银台勾选） */
export async function listUnusedCouponsMatchingPaidAmount(
  userId: string,
  paidAmountPoints: number,
) {
  await expireStaleRechargeCouponsNow();
  const now = new Date();
  return prisma.userRechargeCoupon.findMany({
    where: {
      userId,
      status: "UNUSED",
      expiresAt: { gt: now },
      paidAmountPointsSnap: paidAmountPoints,
    },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      titleSnap: true,
      bonusPointsSnap: true,
      expiresAt: true,
      paidAmountPointsSnap: true,
    },
  });
}

/** 用户当前所有未使用、未过期的充值券（收银台可按实付档位筛选） */
export async function listUserUnusedRechargeCoupons(userId: string) {
  await expireStaleRechargeCouponsNow();
  const now = new Date();
  return prisma.userRechargeCoupon.findMany({
    where: {
      userId,
      status: "UNUSED",
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      titleSnap: true,
      paidAmountPointsSnap: true,
      bonusPointsSnap: true,
      expiresAt: true,
    },
  });
}

export type UserRechargeCouponHistoryRow = {
  id: string;
  status: "UNUSED" | "REDEEMED" | "EXPIRED";
  titleSnap: string;
  paidAmountPointsSnap: number;
  bonusPointsSnap: number;
  templateSlugSnap: string;
  claimedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  orderId: string | null;
};

/** 个人中心展示：领取/核销记录 */
export async function listUserRechargeCouponHistory(
  userId: string,
  take = 50,
): Promise<UserRechargeCouponHistoryRow[]> {
  await expireStaleRechargeCouponsNow();
  return prisma.userRechargeCoupon.findMany({
    where: { userId },
    orderBy: { claimedAt: "desc" },
    take,
    select: {
      id: true,
      status: true,
      titleSnap: true,
      paidAmountPointsSnap: true,
      bonusPointsSnap: true,
      templateSlugSnap: true,
      claimedAt: true,
      expiresAt: true,
      redeemedAt: true,
      orderId: true,
    },
  });
}
