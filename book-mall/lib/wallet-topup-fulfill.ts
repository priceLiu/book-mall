import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";
import { topupCredits } from "@/lib/billing/credit-account-service";
import { assertReasonableTopupBonus } from "@/lib/wallet-topup-fulfill-shared";

/**
 * 充值入账（财务 2.0）：写入 CreditAccount，不再写 WalletEntry。
 * 100 点 = 1 元；积分按锚定 ¥0.04/积分换算（1 元 ≈ 25 积分）。
 */

export type WalletTopupMetaTopup = {
  paidAmountPoints: number;
  bonusPoints: number;
  creditedTotalPoints: number;
  promoSlug?: string;
  promoLabel?: string;
  /** 核销的 UserRechargeCoupon.id，对账入口 */
  rechargeCouponId?: string;
};

export type FulfillWalletTopupInput = {
  userId: string;
  paidAmountPoints: number;
  /** 用户已领取且在有效期内的充值优惠券；与 paid 档位一致时核销并发放赠送点 */
  rechargeCouponId?: string;
  /** 仅内部脚本/迁移兼容：无券时的直接赠送点；勿与 rechargeCouponId 同用 */
  bonusPoints?: number;
  meta?: Prisma.InputJsonObject;
  promo?: { slug?: string; label?: string };
};

export type FulfillWalletTopupResult = {
  orderId: string;
  balanceAfterPoints: number;
  creditedTotalPoints: number;
};

function pointsToCredits(points: number): number {
  const yuan = points / 100;
  return Math.max(0, Math.round(yuan / DEFAULT_CREDIT_ANCHOR_YUAN));
}

function mergeOrderMeta(
  base: Prisma.InputJsonObject | undefined,
  topup: WalletTopupMetaTopup,
): Prisma.InputJsonValue {
  const b = base && typeof base === "object" && !Array.isArray(base) ? { ...base } : {};
  return { ...b, topup } as Prisma.InputJsonValue;
}

export async function fulfillWalletTopupCredits(
  input: FulfillWalletTopupInput,
): Promise<FulfillWalletTopupResult> {
  const paid = input.paidAmountPoints;
  let bonus = input.bonusPoints ?? 0;
  let promoSlug = input.promo?.slug;
  let promoLabel = input.promo?.label;
  let rechargeCouponIdForMeta: string | undefined;

  const cid = input.rechargeCouponId?.trim();
  if (cid) {
    if ((input.bonusPoints ?? 0) !== 0) {
      throw new Error("不可同时使用优惠券与直接指定赠送点");
    }
    if (input.promo) {
      throw new Error("使用优惠券时不要传入 promo 字段");
    }
  }

  if (!cid) {
    assertReasonableTopupBonus(paid, bonus);
  }

  if (!Number.isInteger(paid) || paid <= 0) {
    throw new Error("充值本金（点）须为正整数");
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    if (cid) {
      const userCoupon = await tx.userRechargeCoupon.findFirst({
        where: {
          id: cid,
          userId: input.userId,
          status: "UNUSED",
          expiresAt: { gt: now },
        },
      });
      if (!userCoupon) {
        throw new Error("优惠券不可用、已使用或已过期，请先到个人中心领取有效券");
      }
      if (userCoupon.paidAmountPointsSnap !== paid) {
        throw new Error(
          `该券要求实付 ${userCoupon.paidAmountPointsSnap.toLocaleString("zh-CN")} 点，请切换充值档位后再支付`,
        );
      }
      bonus = userCoupon.bonusPointsSnap;
      promoSlug = userCoupon.templateSlugSnap;
      promoLabel = `优惠券：${userCoupon.titleSnap}`;
      rechargeCouponIdForMeta = userCoupon.id;
      assertReasonableTopupBonus(paid, bonus);
    }

    if (!Number.isInteger(bonus) || bonus < 0) {
      throw new Error("赠送点须为非负整数");
    }

    const total = paid + bonus;
    const topup: WalletTopupMetaTopup = {
      paidAmountPoints: paid,
      bonusPoints: bonus,
      creditedTotalPoints: total,
      promoSlug,
      promoLabel,
      rechargeCouponId: rechargeCouponIdForMeta,
    };

    const order = await tx.order.create({
      data: {
        userId: input.userId,
        type: "WALLET_TOPUP",
        status: "PAID",
        amountPoints: total,
        paidAt: now,
        meta: mergeOrderMeta(input.meta, topup),
      },
    });

    if (rechargeCouponIdForMeta) {
      const redeemed = await tx.userRechargeCoupon.updateMany({
        where: {
          id: rechargeCouponIdForMeta,
          userId: input.userId,
          status: "UNUSED",
        },
        data: {
          status: "REDEEMED",
          redeemedAt: now,
          orderId: order.id,
        },
      });
      if (redeemed.count !== 1) {
        throw new Error("优惠券核销失败（可能已被使用），请刷新后重试");
      }
    }

    const paidCredits = pointsToCredits(paid);
    const bonusCredits = pointsToCredits(bonus);
    const totalCredits = paidCredits + bonusCredits;

    if (paidCredits > 0) {
      await topupCredits({
        ref: { ownerType: "USER", ownerId: input.userId },
        credits: paidCredits,
        refType: "topup_order",
        refId: order.id,
        idempotencyKey: `topup:${order.id}:paid`,
      });
    }
    if (bonusCredits > 0) {
      await topupCredits({
        ref: { ownerType: "USER", ownerId: input.userId },
        credits: bonusCredits,
        refType: "promo_grant",
        refId: order.id,
        idempotencyKey: `topup:${order.id}:bonus`,
      });
    }

    const account = await tx.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: input.userId } },
      select: { balanceCredits: true },
    });

    return {
      orderId: order.id,
      balanceAfterPoints: account?.balanceCredits ?? totalCredits,
      creditedTotalPoints: total,
    };
  });
}

/** 从订单 meta 读取充值分拆；老数据无 topup 时返回 null（即视作旧口径：全额为本金、无赠送） */
export function parseOrderTopupBreakdown(
  meta: unknown,
): WalletTopupMetaTopup | null {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return null;
  const t = (meta as Record<string, unknown>).topup;
  if (t == null || typeof t !== "object" || Array.isArray(t)) return null;
  const rec = t as Record<string, unknown>;
  const paid = rec.paidAmountPoints;
  const b = rec.bonusPoints;
  const c = rec.creditedTotalPoints;
  if (typeof paid !== "number" || !Number.isInteger(paid)) return null;
  if (typeof b !== "number" || !Number.isInteger(b)) return null;
  if (typeof c !== "number" || !Number.isInteger(c)) return null;
  const rc = rec.rechargeCouponId;
  return {
    paidAmountPoints: paid,
    bonusPoints: b,
    creditedTotalPoints: c,
    promoSlug: typeof rec.promoSlug === "string" ? rec.promoSlug : undefined,
    promoLabel: typeof rec.promoLabel === "string" ? rec.promoLabel : undefined,
    rechargeCouponId: typeof rc === "string" ? rc : undefined,
  };
}

/**
 * 已支付钱包充值订单：按 Order.meta.topup 汇总实收点与赠送点（无 meta 的老单计为全额实收、赠送 0）。
 */
export async function aggregateWalletTopupOrdersBreakdown(): Promise<{
  orderCount: number;
  paidPoints: number;
  bonusPoints: number;
  creditedTotalPoints: number;
  ordersWithoutTopupMeta: number;
}> {
  const rows = await prisma.order.findMany({
    where: { type: "WALLET_TOPUP", status: "PAID" },
    select: { amountPoints: true, meta: true },
  });
  let paid = 0;
  let bonus = 0;
  let legacy = 0;
  for (const o of rows) {
    const b = parseOrderTopupBreakdown(o.meta);
    if (b) {
      paid += b.paidAmountPoints;
      bonus += b.bonusPoints;
    } else {
      paid += o.amountPoints;
      legacy += 1;
    }
  }
  return {
    orderCount: rows.length,
    paidPoints: paid,
    bonusPoints: bonus,
    creditedTotalPoints: paid + bonus,
    ordersWithoutTopupMeta: legacy,
  };
}
