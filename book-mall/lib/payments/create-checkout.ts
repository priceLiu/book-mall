import type { Prisma } from "@prisma/client";
import type { PaymentProductKind, PaymentChannel } from "@prisma/client";

import { assertBillingPersona } from "@/lib/billing/billing-persona";
import {
  isAdminOnlyTopupPack,
  packById,
} from "@/lib/billing/credit-topup-packs";
import { canManagePricing } from "@/lib/auth/permissions";
import { verifyAdminTopupVerifyToken } from "@/lib/payments/admin-topup-verify-token";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import {
  resolveVipVideoFraction,
  type VipSchemeKind,
} from "@/lib/finance/vip-package-service";
import { VIP_MIN_AMOUNT_YUAN } from "@/lib/finance/vip-package-calculator";
import { generateOutTradeNo } from "@/lib/payments/out-trade-no";
import { resolvePendingCheckoutDedupe } from "@/lib/payments/checkout-create-dedupe";
import { appendPaymentEvent } from "@/lib/payments/payment-events";
import { generateUniqueRemarkCode } from "@/lib/payments/remark-code";
import { checkoutExpiresHours } from "@/lib/payments/wechat-personal-config";
import { prisma } from "@/lib/prisma";
import { canTenant } from "@/lib/tenant/permission";

export type CreateCheckoutInput =
  | {
      productKind: "MEMBERSHIP_PERSONAL";
      planId: string;
    }
  | {
      productKind: "MEMBERSHIP_TEAM";
      planId: string;
      seats?: number;
      teamName?: string | null;
    }
  | {
      productKind: "BYOK_PERSONAL";
      scopeKey: string;
    }
  | {
      productKind: "BYOK_TEAM";
      scopeKey: string;
      tenantId: string;
      seats?: number;
    }
  | {
      productKind: "CREDIT_TOPUP";
      packId: string;
      target?: "personal" | "team";
      tenantId?: string | null;
      verifyToken?: string | null;
    }
  | {
      productKind: "VIP_PACKAGE";
      amountYuan: number;
      scheme: VipSchemeKind;
      seats?: number;
      teamName?: string | null;
    };

export async function createPaymentCheckout(input: {
  userId: string;
  userRole?: string | null;
  payload: CreateCheckoutInput;
  adminNote?: string | null;
  createdByAdminId?: string | null;
  channel?: PaymentChannel;
}) {
  const { userId, payload } = input;
  const channel = input.channel ?? "WECHAT_PERSONAL";
  let productKind: PaymentProductKind = payload.productKind;
  let amountYuan = 0;
  let productSnapshot: Record<string, unknown> = {};

  switch (payload.productKind) {
    case "MEMBERSHIP_PERSONAL": {
      await assertBillingPersona(userId, ["PLATFORM_CREDIT", "BYOK"]);
      const plan = await prisma.membershipPlan.findUnique({ where: { id: payload.planId } });
      if (!plan || !plan.active) throw new Error("无效的会员套餐");
      amountYuan = Number(plan.priceYuan);
      productSnapshot = {
        planId: plan.id,
        tier: plan.tier,
        planLabel: `${plan.tier}（${plan.interval === "YEAR" ? "年付" : "月付"}）`,
        family: plan.family,
      };
      break;
    }
    case "MEMBERSHIP_TEAM": {
      await assertBillingPersona(userId, ["PLATFORM_CREDIT", "BYOK"]);
      const plan = await prisma.membershipPlan.findUnique({ where: { id: payload.planId } });
      if (!plan || !plan.active || plan.family !== "TEAM") throw new Error("无效的团队套餐");
      const seats = Math.max(
        TEAM_MIN_INCLUDED_SEATS,
        Math.round(payload.seats ?? plan.includedSeats ?? TEAM_MIN_INCLUDED_SEATS),
      );
      const quote = await quoteTeamPlan({ planId: plan.id, totalSeats: seats });
      amountYuan = quote.totalPriceYuan;
      productSnapshot = {
        planId: plan.id,
        tier: plan.tier,
        seats,
        teamName: payload.teamName ?? null,
        planLabel: `${plan.tier}（${plan.interval === "YEAR" ? "年付" : "月付"}）`,
        family: "TEAM",
      };
      break;
    }
    case "BYOK_PERSONAL":
    case "BYOK_TEAM":
      throw new Error("BYOK 技术服务费已退役，请开通会员订阅（报价页）并绑定 Gateway Key");
    case "CREDIT_TOPUP": {
      const pack = packById(payload.packId);
      if (!pack) throw new Error("无效的积分包档位");
      if (isAdminOnlyTopupPack(pack)) {
        if (!canManagePricing(input.userRole)) {
          throw new Error("无权购买该档位");
        }
        if (pack.requirePhoneVerify) {
          if (
            !verifyAdminTopupVerifyToken(payload.verifyToken, userId, pack.id)
          ) {
            throw new Error("请先完成手机号验证");
          }
        }
        if (payload.target === "team") {
          throw new Error("管理员专用包仅支持个人充值");
        }
      }
      amountYuan = pack.priceYuan;
      productSnapshot = {
        packId: pack.id,
        packLabel: pack.label,
        credits: pack.credits,
        pool: pack.pool,
        target: payload.target ?? "personal",
        tenantId: payload.tenantId ?? null,
      };
      if (payload.target === "team") {
        if (!payload.tenantId) throw new Error("请选择团队");
        const member = await prisma.tenantMember.findFirst({
          where: { userId, tenantId: payload.tenantId, status: "ACTIVE" },
          include: { tenant: { select: { type: true, status: true } } },
        });
        if (!member || member.tenant.type !== "TEAM" || member.tenant.status !== "ACTIVE") {
          throw new Error("你不是该团队的活跃成员");
        }
        if (!canTenant(member.role, "billing:manage")) {
          throw new Error("仅主账号或管理员可为团队充值");
        }
      }
      break;
    }
    case "VIP_PACKAGE": {
      await assertBillingPersona(userId, ["PLATFORM_CREDIT", "BYOK"]);
      const vipAmount = Math.round(payload.amountYuan);
      if (vipAmount < VIP_MIN_AMOUNT_YUAN) {
        throw new Error(`VIP 起订金额为 ¥${VIP_MIN_AMOUNT_YUAN.toLocaleString()}`);
      }
      const seats = Math.max(1, Math.round(payload.seats ?? 3));
      const videoFraction = resolveVipVideoFraction(payload.scheme);
      amountYuan = vipAmount;
      productSnapshot = {
        amountYuan: vipAmount,
        scheme: payload.scheme,
        videoFraction,
        seats,
        teamName: payload.teamName ?? null,
        planLabel: `VIP 大额 · ${payload.scheme === "video_heavy" ? "视频多" : "通用多"} · ${seats} 席`,
      };
      break;
    }
    default:
      throw new Error("未知商品类型");
  }

  const remarkCode = await generateUniqueRemarkCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + checkoutExpiresHours());

  return prisma.$transaction(async (tx) => {
    const dedupe = await resolvePendingCheckoutDedupe({
      tx,
      userId,
      productKind,
      productSnapshot,
      amountYuan,
    });
    if (dedupe.action === "reuse") {
      return dedupe.checkout;
    }

    const checkout = await tx.paymentCheckout.create({
      data: {
        outTradeNo: generateOutTradeNo(),
        remarkCode,
        userId,
        productKind,
        productSnapshot: productSnapshot as Prisma.InputJsonValue,
        amountYuan,
        expiresAt,
        adminNote: input.adminNote?.trim() || null,
        channel,
        status: "PENDING",
      },
    });

    await appendPaymentEvent(
      {
        checkoutId: checkout.id,
        actorUserId: input.createdByAdminId ?? userId,
        action: "CREATE",
        payload: {
          productKind,
          amountYuan,
          createdByAdminId: input.createdByAdminId ?? null,
        },
      },
      tx,
    );

    return checkout;
  });
}
