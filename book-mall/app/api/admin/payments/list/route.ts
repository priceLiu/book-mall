import { NextResponse, type NextRequest } from "next/server";

import { productKindLabel } from "@/lib/payments/product-labels";
import { requirePaymentAdminSession } from "@/lib/payments/session-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requirePaymentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status")?.trim();
  const where =
    status === "paid"
      ? { status: "PAID" as const }
      : { status: { in: ["PENDING", "AWAITING_CONFIRM"] as ("PENDING" | "AWAITING_CONFIRM")[] } };

  const rows = await prisma.paymentCheckout.findMany({
    where,
    include: { user: { select: { id: true, email: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const checkoutIds = rows.map((c) => c.id);
  const submittedEvents =
    checkoutIds.length > 0
      ? await prisma.paymentEvent.findMany({
          where: {
            checkoutId: { in: checkoutIds },
            action: "USER_SUBMITTED",
          },
          select: { checkoutId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const submittedAtByCheckout = new Map<string, string>();
  for (const ev of submittedEvents) {
    if (!submittedAtByCheckout.has(ev.checkoutId)) {
      submittedAtByCheckout.set(ev.checkoutId, ev.createdAt.toISOString());
    }
  }

  return NextResponse.json({
    checkouts: rows.map((c) => {
      const snap = c.productSnapshot as Record<string, unknown>;
      return {
        id: c.id,
        remarkCode: c.remarkCode,
        outTradeNo: c.outTradeNo,
        status: c.status,
        amountYuan: Number(c.amountYuan),
        productKind: c.productKind,
        productLabel: productKindLabel(c.productKind, snap),
        createdAt: c.createdAt.toISOString(),
        submittedAt: submittedAtByCheckout.get(c.id) ?? null,
        paidAt: c.paidAt?.toISOString() ?? null,
        user: c.user,
      };
    }),
  });
}
