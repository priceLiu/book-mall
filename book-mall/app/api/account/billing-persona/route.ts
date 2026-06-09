import { NextResponse } from "next/server";
import type { BillingPersona } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lockBillingPersona } from "@/lib/billing/billing-persona";
import { syncGatewayUserFromBookUser } from "@/lib/gateway/sync-user";
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";

export const dynamic = "force-dynamic";

const schema = z.object({
  billingPersona: z.enum(["PLATFORM_CREDIT", "BYOK"]),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "请选择计费身份" }, { status: 400 });
  }

  const persona = parsed.data.billingPersona as BillingPersona;

  try {
    await lockBillingPersona(session.user.id, persona);
    if (session.user.email) {
      await syncGatewayUserFromBookUser({
        bookUserId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      });
    }
    if (persona === "PLATFORM_CREDIT") {
      await ensurePlatformManagedKeyForUser(session.user.id);
    }
    return NextResponse.json({ ok: true, billingPersona: persona });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
