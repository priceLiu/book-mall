import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import { productKindLabel } from "@/lib/payments/product-labels";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** finance-web 支付明细：PaymentCheckout + Order 联查 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "支付明细仅财务管理员可见");
  }

  const limit = Math.min(
    200,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "50")),
  );
  const status = request.nextUrl.searchParams.get("status")?.trim();

  const rows = await prisma.paymentCheckout.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
      order: { select: { id: true, amountYuan: true, type: true, status: true } },
      confirmedBy: { select: { email: true, name: true } },
    },
  });

  const ledgerKeys = rows
    .filter((r) => r.status === "PAID")
    .map((r) => `payment_checkout:${r.id}`);
  const ledgers =
    ledgerKeys.length > 0
      ? await prisma.creditLedger.findMany({
          where: { idempotencyKey: { in: ledgerKeys } },
          select: {
            idempotencyKey: true,
            type: true,
            credits: true,
            pool: true,
            createdAt: true,
          },
        })
      : [];
  const ledgerByCheckout = new Map(
    ledgers.map((l) => [l.idempotencyKey?.replace("payment_checkout:", "") ?? "", l]),
  );

  return financeJson(request, {
    checkouts: rows.map((r) => {
      const ledger = ledgerByCheckout.get(r.id);
      return {
        id: r.id,
        outTradeNo: r.outTradeNo,
        remarkCode: r.remarkCode,
        status: r.status,
        productKind: r.productKind,
        productLabel: productKindLabel(r.productKind, r.productSnapshot as Record<string, unknown>),
        amountYuan: Number(r.amountYuan),
        confirmMode: r.confirmMode,
        adminNote: r.adminNote,
        paidAt: r.paidAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
        order: r.order
          ? {
              id: r.order.id,
              amountYuan: r.order.amountYuan ? Number(r.order.amountYuan) : null,
              type: r.order.type,
              status: r.order.status,
            }
          : null,
        confirmedBy: r.confirmedBy,
        ledger: ledger
          ? {
              type: ledger.type,
              credits: ledger.credits,
              pool: ledger.pool,
              createdAt: ledger.createdAt.toISOString(),
            }
          : null,
      };
    }),
  });
}
