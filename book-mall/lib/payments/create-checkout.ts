import type { Prisma } from "@prisma/client";
import type { PaymentProductKind } from "@prisma/client";

import { assertBillingPersona } from "@/lib/billing/billing-persona";
import { BYOK_SCOPE_TEAM_SEAT } from "@/lib/billing/byok-pricing";
import { resolveByokSeatsForTenant } from "@/lib/billing/byok-subscription-service";
import { packById } from "@/lib/billing/credit-topup-packs";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { generateOutTradeNo } from "@/lib/payments/out-trade-no";
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
    };

export async function createPaymentCheckout(input: {
  userId: string;
  payload: CreateCheckoutInput;
  adminNote?: string | null;
  createdByAdminId?: string | null;
}) {
  const { userId, payload } = input;
  let productKind: PaymentProductKind = payload.productKind;
  let amountYuan = 0;
  let productSnapshot: Record<string, unknown> = {};

  switch (payload.productKind) {
    case "MEMBERSHIP_PERSONAL": {
      await assertBillingPersona(userId, "PLATFORM_CREDIT");
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
      await assertBillingPersona(userId, "PLATFORM_CREDIT");
      const plan = await prisma.membershipPlan.findUnique({ where: { id: payload.planId } });
      if (!plan || !plan.active || plan.family !== "TEAM") throw new Error("无效的团队套餐");
      const seats = Math.max(1, Math.round(payload.seats ?? plan.includedSeats ?? 1));
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
    case "BYOK_PERSONAL": {
      await assertBillingPersona(userId, "BYOK");
      const cfg = await prisma.byokServiceConfig.findUnique({
        where: { scopeKey: payload.scopeKey },
      });
      if (!cfg || !cfg.active) throw new Error("无效的 BYOK 套餐");
      amountYuan = Number(cfg.techServiceFeeYuan);
      productSnapshot = { scopeKey: cfg.scopeKey, label: cfg.label };
      break;
    }
    case "BYOK_TEAM": {
      await assertBillingPersona(userId, "BYOK");
      const cfg = await prisma.byokServiceConfig.findUnique({
        where: { scopeKey: payload.scopeKey },
      });
      if (!cfg || !cfg.active || payload.scopeKey !== BYOK_SCOPE_TEAM_SEAT) {
        throw new Error("无效的团队 BYOK 套餐");
      }
      const member = await prisma.tenantMember.findFirst({
        where: { userId, tenantId: payload.tenantId, status: "ACTIVE" },
        include: { tenant: { select: { type: true, status: true } } },
      });
      if (!member || member.tenant.type !== "TEAM" || member.tenant.status !== "ACTIVE") {
        throw new Error("你不是该团队的活跃成员");
      }
      if (!canTenant(member.role, "billing:manage")) {
        throw new Error("仅团队主账号可开通团队 BYOK");
      }
      const seats = payload.seats
        ? Math.max(cfg.minSeats ?? 3, Math.round(payload.seats))
        : await resolveByokSeatsForTenant(payload.tenantId);
      amountYuan = Number(cfg.techServiceFeeYuan) * seats;
      productSnapshot = {
        scopeKey: cfg.scopeKey,
        label: cfg.label,
        tenantId: payload.tenantId,
        seats,
      };
      break;
    }
    case "CREDIT_TOPUP": {
      const pack = packById(payload.packId);
      if (!pack) throw new Error("无效的积分包档位");
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
    default:
      throw new Error("未知商品类型");
  }

  const remarkCode = await generateUniqueRemarkCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + checkoutExpiresHours());

  const checkout = await prisma.paymentCheckout.create({
    data: {
      outTradeNo: generateOutTradeNo(),
      remarkCode,
      userId,
      productKind,
      productSnapshot: productSnapshot as Prisma.InputJsonValue,
      amountYuan,
      expiresAt,
      adminNote: input.adminNote?.trim() || null,
      status: "PENDING",
    },
  });

  await appendPaymentEvent({
    checkoutId: checkout.id,
    actorUserId: input.createdByAdminId ?? userId,
    action: "CREATE",
    payload: {
      productKind,
      amountYuan,
      createdByAdminId: input.createdByAdminId ?? null,
    },
  });

  return checkout;
}
