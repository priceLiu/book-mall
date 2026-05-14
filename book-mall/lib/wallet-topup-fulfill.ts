import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertReasonableTopupBonus } from "@/lib/wallet-topup-fulfill-shared";

/**
 * 钱包充值入账（唯一推荐入口）：真实支付 notify 与模拟收银均应调用本模块，
 * 避免在多处重复「加余额 + Order + WalletEntry」逻辑。
 *
 * 约定：100 点 = 1 元（1 点 = ¥0.01），与全站 `*Points` 字段一致。
 *
 * 订单：Order.amountPoints = 用户本次「到账点数合计」（本金 + 赠送），与钱包增量一致。
 * 分拆信息：Order.meta.topup = { paidAmountPoints, bonusPoints, creditedTotalPoints, rechargeCouponId?, ... }，
 * 便于财务只统计实收（SUM paid）与赠送成本分析；老订单无 topup 字段时视为 bonus=0。
 *
 * 充送优惠：须用户先在个人中心「领取」优惠券；充值时传入 rechargeCouponId 核销，否则无任何赠送。
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

    const paidYuan = (paid / 100).toFixed(2);
    const bonusDescr =
      bonus > 0
        ? `${promoLabel ?? "活动赠送"} +${bonus.toLocaleString("zh-CN")} 点（¥${(bonus / 100).toFixed(2)}）`
        : "";

    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: input.userId },
    });

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

    if (bonus === 0) {
      const next = wallet.balancePoints + paid;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balancePoints: next },
      });
      await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: "RECHARGE",
          amountPoints: paid,
          balanceAfterPoints: next,
          description: `充值入账 ¥${paidYuan}`,
          orderId: order.id,
        },
      });
      return {
        orderId: order.id,
        balanceAfterPoints: next,
        creditedTotalPoints: total,
      };
    }

    const mid = wallet.balancePoints + paid;
    const next = mid + bonus;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePoints: next },
    });

    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "RECHARGE",
        amountPoints: paid,
        balanceAfterPoints: mid,
        description: `充值入账 ¥${paidYuan}`,
        orderId: order.id,
      },
    });

    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "RECHARGE",
        amountPoints: bonus,
        balanceAfterPoints: next,
        description: bonusDescr,
        orderId: order.id,
      },
    });

    return {
      orderId: order.id,
      balanceAfterPoints: next,
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
