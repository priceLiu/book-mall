import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createPaymentCheckout } from "@/lib/payments/create-checkout";
import { instantConfirmCheckoutByAdmin } from "@/lib/payments/confirm-checkout";
import { requirePaymentAdminSession } from "@/lib/payments/session-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  targetEmail: z.string().email(),
  productKind: z.enum([
    "MEMBERSHIP_PERSONAL",
    "MEMBERSHIP_TEAM",
    "BYOK_PERSONAL",
    "BYOK_TEAM",
    "CREDIT_TOPUP",
  ]),
  planId: z.string().optional(),
  packId: z.string().optional(),
  scopeKey: z.string().optional(),
  tenantId: z.string().optional().nullable(),
  seats: z.number().int().optional(),
  teamName: z.string().optional().nullable(),
  target: z.enum(["personal", "team"]).optional(),
  adminNote: z.string().min(1).max(500),
  confirmImmediately: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requirePaymentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
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

  const targetUser = await prisma.user.findUnique({
    where: { email: parsed.data.targetEmail.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "目标用户不存在" }, { status: 404 });
  }

  try {
    const payload = buildPayload(parsed.data);
    const checkout = await createPaymentCheckout({
      userId: targetUser.id,
      payload,
      adminNote: parsed.data.adminNote,
      createdByAdminId: session.user.id,
    });

    let orderId: string | undefined;
    if (parsed.data.confirmImmediately) {
      const result = await instantConfirmCheckoutByAdmin({
        checkoutId: checkout.id,
        confirmedByUserId: session.user.id,
        adminNote: parsed.data.adminNote,
      });
      orderId = result.orderId;
    }

    return NextResponse.json({
      ok: true,
      checkoutId: checkout.id,
      remarkCode: checkout.remarkCode,
      orderId,
      targetEmail: targetUser.email,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

function buildPayload(data: z.infer<typeof bodySchema>): Parameters<typeof createPaymentCheckout>[0]["payload"] {
  switch (data.productKind) {
    case "MEMBERSHIP_PERSONAL":
      if (!data.planId) throw new Error("缺少 planId");
      return { productKind: "MEMBERSHIP_PERSONAL", planId: data.planId };
    case "MEMBERSHIP_TEAM":
      if (!data.planId) throw new Error("缺少 planId");
      return {
        productKind: "MEMBERSHIP_TEAM",
        planId: data.planId,
        seats: data.seats,
        teamName: data.teamName,
      };
    case "BYOK_PERSONAL":
      if (!data.scopeKey) throw new Error("缺少 scopeKey");
      return { productKind: "BYOK_PERSONAL", scopeKey: data.scopeKey };
    case "BYOK_TEAM":
      if (!data.scopeKey || !data.tenantId) throw new Error("缺少 scopeKey 或 tenantId");
      return {
        productKind: "BYOK_TEAM",
        scopeKey: data.scopeKey,
        tenantId: data.tenantId,
        seats: data.seats,
      };
    case "CREDIT_TOPUP":
      if (!data.packId) throw new Error("缺少 packId");
      return {
        productKind: "CREDIT_TOPUP",
        packId: data.packId,
        target: data.target,
        tenantId: data.tenantId,
      };
    default:
      throw new Error("未知商品类型");
  }
}
