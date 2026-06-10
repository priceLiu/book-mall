/**
 * 模拟开通 / 运维对齐 / 历史补录：写入已确认的 PaymentCheckout + Order 审计流水。
 * 不重复开通 BYOK（权益须已由 activateByokSubscription 或 align 脚本写入）。
 */
import type { PaymentConfirmMode, PaymentProductKind } from "@prisma/client";

import { BYOK_SCOPE_PERSONAL, BYOK_SCOPE_TEAM_SEAT } from "@/lib/billing/byok-pricing";
import { appendPaymentEvent } from "@/lib/payments/payment-events";
import { generateOutTradeNo } from "@/lib/payments/out-trade-no";
import { orderTypeForProductKind } from "@/lib/payments/product-labels";
import { generateUniqueRemarkCode } from "@/lib/payments/remark-code";
import { prisma } from "@/lib/prisma";

export type AdminByokCheckoutSource = "MOCK" | "ADMIN_ALIGN" | "BACKFILL";

export async function recordAdminPaidByokCheckout(input: {
  userId: string;
  scopeKey: string;
  tenantId?: string | null;
  seats?: number;
  confirmedByUserId: string;
  source: AdminByokCheckoutSource;
  adminNote?: string | null;
  /** 补录时用订阅开通时间作为 paidAt */
  paidAt?: Date;
  /** 幂等：同一 subscriptionId 只补一条 */
  subscriptionId?: string | null;
}): Promise<{ checkoutId: string; orderId: string; created: boolean }> {
  const scopeKey = input.scopeKey.trim();
  if (scopeKey !== BYOK_SCOPE_PERSONAL && scopeKey !== BYOK_SCOPE_TEAM_SEAT) {
    throw new Error("无效的 BYOK scopeKey");
  }

  const productKind: PaymentProductKind =
    scopeKey === BYOK_SCOPE_TEAM_SEAT ? "BYOK_TEAM" : "BYOK_PERSONAL";

  if (input.subscriptionId) {
    const existing = await prisma.order.findFirst({
      where: {
        userId: input.userId,
        type: "BYOK_SERVICE_FEE",
        status: "PAID",
        meta: {
          path: ["byokSubscriptionId"],
          equals: input.subscriptionId,
        },
      },
      select: { id: true, paymentCheckoutId: true },
    });
    if (existing?.paymentCheckoutId) {
      return {
        checkoutId: existing.paymentCheckoutId,
        orderId: existing.id,
        created: false,
      };
    }
  }

  const cfg = await prisma.byokServiceConfig.findUnique({ where: { scopeKey } });
  if (!cfg || !cfg.active) throw new Error("BYOK 套餐未配置或已下线");

  const seats = Math.max(1, Math.round(input.seats ?? 1));
  const amountYuan =
    scopeKey === BYOK_SCOPE_TEAM_SEAT
      ? Number(cfg.techServiceFeeYuan) * seats
      : Number(cfg.techServiceFeeYuan);

  const productSnapshot: Record<string, unknown> = {
    scopeKey: cfg.scopeKey,
    label: cfg.label,
    source: input.source,
    ...(scopeKey === BYOK_SCOPE_TEAM_SEAT
      ? { tenantId: input.tenantId ?? null, seats }
      : {}),
    ...(input.subscriptionId ? { byokSubscriptionId: input.subscriptionId } : {}),
  };

  const note =
    input.adminNote?.trim() ||
    (input.source === "MOCK"
      ? "开发模拟开通 BYOK（审计补录）"
      : input.source === "ADMIN_ALIGN"
        ? "运维对齐 BYOK 权益（审计补录）"
        : "历史 BYOK 开通补录");

  const paidAt = input.paidAt ?? new Date();
  const confirmMode: PaymentConfirmMode = "ADMIN_INSTANT";

  const checkout = await prisma.paymentCheckout.create({
    data: {
      outTradeNo: generateOutTradeNo(),
      remarkCode: await generateUniqueRemarkCode(),
      userId: input.userId,
      productKind,
      productSnapshot,
      amountYuan,
      status: "PAID",
      confirmMode,
      confirmedByUserId: input.confirmedByUserId,
      adminNote: note,
      paidAt,
      expiresAt: new Date(paidAt.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      type: orderTypeForProductKind(productKind),
      status: "PAID",
      amountPoints: Math.round(amountYuan * 100),
      amountYuan,
      paidAt,
      paymentCheckoutId: checkout.id,
      meta: {
        productKind,
        remarkCode: checkout.remarkCode,
        outTradeNo: checkout.outTradeNo,
        confirmMode,
        productSnapshot,
        source: input.source,
        scopeKey,
        ...(input.subscriptionId ? { byokSubscriptionId: input.subscriptionId } : {}),
      },
    },
  });

  await appendPaymentEvent({
    checkoutId: checkout.id,
    actorUserId: input.confirmedByUserId,
    action: "CREATE",
    payload: { source: input.source, amountYuan, auditOnly: true },
  });
  await appendPaymentEvent({
    checkoutId: checkout.id,
    actorUserId: input.confirmedByUserId,
    action: "ADMIN_INSTANT",
    payload: { orderId: order.id, adminNote: note, auditOnly: true },
  });

  if (input.subscriptionId) {
    await prisma.byokSubscription
      .update({
        where: { id: input.subscriptionId },
        data: { lastOrderId: checkout.id },
      })
      .catch(() => undefined);
  }

  return { checkoutId: checkout.id, orderId: order.id, created: true };
}
