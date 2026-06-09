import { NextResponse, type NextRequest } from "next/server";

import { cancelCheckout } from "@/lib/payments/confirm-checkout";
import { requirePaymentAdminSession } from "@/lib/payments/session-auth";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requirePaymentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const ok = await cancelCheckout({
    checkoutId: params.id,
    actorUserId: session.user.id,
  });
  if (!ok) {
    return NextResponse.json({ error: "无法取消（可能已确认或已失效）" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
