import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { confirmCheckoutByAdmin } from "@/lib/payments/confirm-checkout";
import { requirePaymentAdminSession } from "@/lib/payments/session-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  adminNote: z.string().max(500).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requirePaymentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  let adminNote: string | null | undefined;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    adminNote = parsed.success ? parsed.data.adminNote : undefined;
  } catch {
    /* empty body ok */
  }

  try {
    const result = await confirmCheckoutByAdmin({
      checkoutId: params.id,
      confirmedByUserId: session.user.id,
      adminNote,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
