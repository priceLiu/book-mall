import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { createPaymentCheckout } from "@/lib/payments/create-checkout";
import {
  canUseAdminInstantCheckout,
  requirePaymentAdminSession,
} from "@/lib/payments/session-auth";
import {
  getWechatPayeeName,
  getWechatPersonalQrUrl,
} from "@/lib/payments/wechat-personal-config";
import { productKindLabel } from "@/lib/payments/product-labels";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("productKind", [
  z.object({ productKind: z.literal("MEMBERSHIP_PERSONAL"), planId: z.string().min(1) }),
  z.object({
    productKind: z.literal("MEMBERSHIP_TEAM"),
    planId: z.string().min(1),
    seats: z.number().int().optional(),
    teamName: z.string().optional().nullable(),
  }),
  z.object({ productKind: z.literal("BYOK_PERSONAL"), scopeKey: z.string().min(1) }),
  z.object({
    productKind: z.literal("BYOK_TEAM"),
    scopeKey: z.string().min(1),
    tenantId: z.string().min(1),
    seats: z.number().int().optional(),
  }),
  z.object({
    productKind: z.literal("CREDIT_TOPUP"),
    packId: z.string().min(1),
    target: z.enum(["personal", "team"]).optional(),
    tenantId: z.string().optional().nullable(),
  }),
]);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  try {
    const checkout = await createPaymentCheckout({
      userId: session.user.id,
      payload: parsed.data,
    });
    const snap = checkout.productSnapshot as Record<string, unknown>;
    const adminInstant = canUseAdminInstantCheckout(session.user.role);

    return NextResponse.json({
      checkout: {
        id: checkout.id,
        outTradeNo: checkout.outTradeNo,
        remarkCode: checkout.remarkCode,
        amountYuan: Number(checkout.amountYuan),
        status: checkout.status,
        expiresAt: checkout.expiresAt.toISOString(),
        productKind: checkout.productKind,
        productLabel: productKindLabel(checkout.productKind, snap),
      },
      wechat: {
        qrUrl: adminInstant ? null : getWechatPersonalQrUrl(),
        payeeName: getWechatPayeeName(),
      },
      adminInstant,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
