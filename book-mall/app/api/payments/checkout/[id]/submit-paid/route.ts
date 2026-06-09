import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { submitCheckoutPaid } from "@/lib/payments/confirm-checkout";
import { productKindLabel } from "@/lib/payments/product-labels";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const checkout = await submitCheckoutPaid({
      checkoutId: params.id,
      userId: session.user.id,
    });
    const snap = checkout.productSnapshot as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      checkout: {
        id: checkout.id,
        status: checkout.status,
        remarkCode: checkout.remarkCode,
        productLabel: productKindLabel(checkout.productKind, snap),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
