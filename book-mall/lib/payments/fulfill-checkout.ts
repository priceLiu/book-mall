/**
 * 支付确认后唯一入账口：Order + 权益 + PaymentEvent
 */
import type { PaymentCheckout, PaymentConfirmMode, Prisma } from "@prisma/client";

import { assertBillingPersona } from "@/lib/billing/billing-persona";
import {
  activateByokSubscription,
  resolveByokSeatsForTenant,
} from "@/lib/billing/byok-subscription-service";
import {
  BYOK_SCOPE_PERSONAL,
  BYOK_SCOPE_TEAM_SEAT,
} from "@/lib/billing/byok-pricing";
import { grantCredits, topupCredits } from "@/lib/billing/credit-account-service";
import { packById } from "@/lib/billing/credit-topup-packs";
import { resolvePlanCreditGrants } from "@/lib/billing/plan-credit-grants";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import { ensurePlatformManagedKeyForTenant } from "@/lib/gateway/platform-managed-key";
import { appendPaymentEvent } from "@/lib/payments/payment-events";
import { orderTypeForProductKind } from "@/lib/payments/product-labels";
import { prisma } from "@/lib/prisma";
import { createTeamTenant } from "@/lib/tenant/tenant-service";
import { canTenant } from "@/lib/tenant/permission";

function snapshotJson(checkout: PaymentCheckout): Record<string, unknown> {
  const raw = checkout.productSnapshot;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function idempotencyBase(checkoutId: string): string {
  return `payment_checkout:${checkoutId}`;
}

async function fulfillMembership(
  checkout: PaymentCheckout,
  snap: Record<string, unknown>,
) {
  const planId = String(snap.planId ?? "");
  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw new Error("无效的会员套餐");

  await assertBillingPersona(checkout.userId, "PLATFORM_CREDIT");

  const periodEnd = new Date();
  if (plan.interval === "YEAR") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const idem = idempotencyBase(checkout.id);

  if (checkout.productKind === "MEMBERSHIP_TEAM") {
    const totalSeats = Math.max(
      TEAM_MIN_INCLUDED_SEATS,
      Math.round(Number(snap.seats) || plan.includedSeats || TEAM_MIN_INCLUDED_SEATS),
    );
    const quote = await quoteTeamPlan({ planId: plan.id, totalSeats });
    const name =
      typeof snap.teamName === "string" && snap.teamName.trim()
        ? snap.teamName.trim()
        : `团队 ${new Date().toISOString().slice(0, 10)}`;

    const existingTeam = await prisma.tenantMember.findFirst({
      where: {
        userId: checkout.userId,
        status: "ACTIVE",
        role: "OWNER",
        tenant: { type: "TEAM", status: "ACTIVE", planId: plan.id },
      },
      select: { tenantId: true },
    });

    let tenantId = existingTeam?.tenantId;
    if (!tenantId) {
      const tenant = await createTeamTenant({
        ownerUserId: checkout.userId,
        name,
        planId: plan.id,
        packageLevel: plan.tier,
        interval: plan.interval,
        seatLimit: quote.totalSeats,
        perSeatCapCredits: null,
      });
      tenantId = tenant.id;
      try {
        await ensurePlatformManagedKeyForTenant(tenantId);
      } catch {
        /* non-fatal */
      }
    } else {
      const member = await prisma.tenantMember.findFirst({
        where: { userId: checkout.userId, tenantId, status: "ACTIVE" },
      });
      if (!member || !canTenant(member.role, "billing:manage")) {
        throw new Error("仅团队主账号可续订团队套餐");
      }
    }

    const grants = resolvePlanCreditGrants(plan, quote.totalSeats);
    await grantCredits({
      ref: { ownerType: "TENANT", ownerId: tenantId },
      credits: grants.generalCredits,
      videoCredits: grants.videoCredits,
      monthlyGrantCredits: grants.monthlyGrantCredits,
      videoMonthlyGrantCredits: grants.videoMonthlyGrantCredits,
      pricePerCreditYuan:
        quote.perSeatCredits > 0 ? quote.totalPriceYuan / quote.monthlyCreditsPool : null,
      planId: plan.id,
      currentPeriodEnd: periodEnd,
      idempotencyKey: idem,
      description: `团队会员开通（${plan.tier} × ${quote.totalSeats} 席）`,
    });

    return {
      amountPoints: grants.generalCredits + grants.videoCredits,
      meta: { tenantId, planId: plan.id, family: "TEAM" },
    };
  }

  const grants = resolvePlanCreditGrants(plan, 1);
  await grantCredits({
    ref: { ownerType: "USER", ownerId: checkout.userId },
    credits: grants.generalCredits,
    videoCredits: grants.videoCredits,
    monthlyGrantCredits: grants.monthlyGrantCredits,
    videoMonthlyGrantCredits: grants.videoMonthlyGrantCredits,
    pricePerCreditYuan:
      plan.monthlyCredits > 0 ? Number(plan.priceYuan) / plan.monthlyCredits : null,
    planId: plan.id,
    currentPeriodEnd: periodEnd,
    idempotencyKey: idem,
    description: `个人会员开通（${plan.tier}）`,
  });

  return {
    amountPoints: grants.generalCredits + grants.videoCredits,
    meta: { planId: plan.id, family: "PERSONAL" },
  };
}

async function fulfillCreditTopup(checkout: PaymentCheckout, snap: Record<string, unknown>) {
  const packId = String(snap.packId ?? "");
  const pack = packById(packId);
  if (!pack) throw new Error("无效的积分包档位");

  let ownerType: "USER" | "TENANT" = "USER";
  let ownerId = checkout.userId;
  const idem = idempotencyBase(checkout.id);

  if (snap.target === "team") {
    const tenantId = String(snap.tenantId ?? "");
    if (!tenantId) throw new Error("请选择团队空间");
    const member = await prisma.tenantMember.findFirst({
      where: { userId: checkout.userId, tenantId, status: "ACTIVE" },
      include: { tenant: { select: { type: true, status: true } } },
    });
    if (!member || member.tenant.type !== "TEAM" || member.tenant.status !== "ACTIVE") {
      throw new Error("你不是该团队的活跃成员");
    }
    if (!canTenant(member.role, "billing:manage")) {
      throw new Error("仅主账号或管理员可为团队充值");
    }
    ownerType = "TENANT";
    ownerId = tenantId;
  }

  await topupCredits({
    ref: { ownerType, ownerId },
    credits: pack.credits,
    pool: pack.pool,
    refType: "payment_order",
    refId: checkout.id,
    idempotencyKey: idem,
    description: `${pack.label}充值`,
  });

  return { amountPoints: pack.credits, meta: { packId: pack.id, pool: pack.pool } };
}

async function fulfillByok(checkout: PaymentCheckout, snap: Record<string, unknown>) {
  await assertBillingPersona(checkout.userId, "BYOK");

  const scopeKey = String(snap.scopeKey ?? "");
  if (scopeKey !== BYOK_SCOPE_PERSONAL && scopeKey !== BYOK_SCOPE_TEAM_SEAT) {
    throw new Error("无效的 BYOK 档位");
  }

  let ownerType: "USER" | "TENANT" = "USER";
  let ownerId = checkout.userId;
  let seats = 1;

  if (checkout.productKind === "BYOK_TEAM" || scopeKey === BYOK_SCOPE_TEAM_SEAT) {
    const tenantId = String(snap.tenantId ?? "");
    if (!tenantId) throw new Error("请选择团队");
    const member = await prisma.tenantMember.findFirst({
      where: { userId: checkout.userId, tenantId, status: "ACTIVE" },
      include: { tenant: { select: { type: true, status: true } } },
    });
    if (!member || member.tenant.type !== "TEAM" || member.tenant.status !== "ACTIVE") {
      throw new Error("你不是该团队的活跃成员");
    }
    if (!canTenant(member.role, "billing:manage")) {
      throw new Error("仅团队主账号可开通团队 BYOK");
    }
    ownerType = "TENANT";
    ownerId = tenantId;
    seats = snap.seats
      ? Math.max(1, Math.round(Number(snap.seats)))
      : await resolveByokSeatsForTenant(tenantId);
  }

  const result = await activateByokSubscription({
    ownerType,
    ownerId,
    scopeKey,
    seats,
    orderId: checkout.id,
  });

  return {
    amountPoints: Math.round(Number(checkout.amountYuan) * 100),
    meta: { scopeKey, ownerType, ownerId, periodEnd: result.periodEnd.toISOString() },
  };
}

async function runProductFulfillment(checkout: PaymentCheckout, snap: Record<string, unknown>) {
  switch (checkout.productKind) {
    case "MEMBERSHIP_PERSONAL":
    case "MEMBERSHIP_TEAM":
      return fulfillMembership(checkout, snap);
    case "CREDIT_TOPUP":
      return fulfillCreditTopup(checkout, snap);
    case "BYOK_PERSONAL":
    case "BYOK_TEAM":
      return fulfillByok(checkout, snap);
    default:
      throw new Error("未知商品类型");
  }
}

export type FulfillPaymentCheckoutResult = {
  checkoutId: string;
  orderId: string;
  alreadyPaid: boolean;
};

export async function fulfillPaymentCheckout(input: {
  checkoutId: string;
  confirmMode: PaymentConfirmMode;
  confirmedByUserId: string;
  adminNote?: string | null;
}): Promise<FulfillPaymentCheckoutResult> {
  const checkout = await prisma.paymentCheckout.findUnique({ where: { id: input.checkoutId } });
  if (!checkout) throw new Error("支付单不存在");

  if (checkout.status === "PAID") {
    const existingOrder = await prisma.order.findFirst({
      where: { paymentCheckoutId: checkout.id },
      select: { id: true },
    });
    return {
      checkoutId: checkout.id,
      orderId: existingOrder?.id ?? "",
      alreadyPaid: true,
    };
  }

  if (checkout.status === "CANCELLED" || checkout.status === "EXPIRED") {
    throw new Error("支付单已失效");
  }

  if (checkout.expiresAt < new Date()) {
    await prisma.paymentCheckout.update({
      where: { id: checkout.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("支付单已过期");
  }

  const snap = snapshotJson(checkout);
  const fulfillment = await runProductFulfillment(checkout, snap);
  const now = new Date();

  const order = await prisma.$transaction(async (tx) => {
    const locked = await tx.paymentCheckout.updateMany({
      where: {
        id: checkout.id,
        status: { in: ["PENDING", "AWAITING_CONFIRM"] },
      },
      data: {
        status: "PAID",
        confirmMode: input.confirmMode,
        confirmedByUserId: input.confirmedByUserId,
        adminNote: input.adminNote?.trim() || checkout.adminNote,
        paidAt: now,
      },
    });
    if (locked.count !== 1) {
      const existing = await tx.order.findFirst({
        where: { paymentCheckoutId: checkout.id },
        select: { id: true },
      });
      if (existing) return existing;
      throw new Error("支付单状态已变更，请刷新");
    }

    return tx.order.create({
      data: {
        userId: checkout.userId,
        type: orderTypeForProductKind(checkout.productKind),
        status: "PAID",
        amountPoints: fulfillment.amountPoints,
        amountYuan: checkout.amountYuan,
        paidAt: now,
        paymentCheckoutId: checkout.id,
        meta: {
          productKind: checkout.productKind,
          remarkCode: checkout.remarkCode,
          outTradeNo: checkout.outTradeNo,
          confirmMode: input.confirmMode,
          productSnapshot: snap,
          ...fulfillment.meta,
        } as Prisma.InputJsonValue,
      },
    });
  });

  await appendPaymentEvent({
    checkoutId: checkout.id,
    actorUserId: input.confirmedByUserId,
    action: input.confirmMode === "ADMIN_INSTANT" ? "ADMIN_INSTANT" : "ADMIN_CONFIRM",
    payload: { orderId: order.id, adminNote: input.adminNote ?? null },
  });

  return { checkoutId: checkout.id, orderId: order.id, alreadyPaid: false };
}
