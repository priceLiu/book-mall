import { NextResponse, type NextRequest } from "next/server";

import { lookupCheckoutByRemarkCode } from "@/lib/payments/confirm-checkout";
import { isValidRemarkCode, normalizeRemarkCode } from "@/lib/payments/remark-code";
import { productKindLabel } from "@/lib/payments/product-labels";
import { requirePaymentAdminSession } from "@/lib/payments/session-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requirePaymentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const code = normalizeRemarkCode(request.nextUrl.searchParams.get("code") ?? "");
  if (!isValidRemarkCode(code)) {
    return NextResponse.json({ error: "请输入 6 位数字备注码" }, { status: 400 });
  }

  const checkout = await lookupCheckoutByRemarkCode(code);
  if (!checkout) {
    return NextResponse.json({ error: "未找到待核对订单" }, { status: 404 });
  }

  const snap = checkout.productSnapshot as Record<string, unknown>;
  const submitted = await prisma.paymentEvent.findFirst({
    where: { checkoutId: checkout.id, action: "USER_SUBMITTED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return NextResponse.json({
    checkout: {
      id: checkout.id,
      remarkCode: checkout.remarkCode,
      outTradeNo: checkout.outTradeNo,
      status: checkout.status,
      amountYuan: Number(checkout.amountYuan),
      productKind: checkout.productKind,
      productLabel: productKindLabel(checkout.productKind, snap),
      createdAt: checkout.createdAt.toISOString(),
      submittedAt: submitted?.createdAt.toISOString() ?? null,
      expiresAt: checkout.expiresAt.toISOString(),
      user: checkout.user,
    },
  });
}
