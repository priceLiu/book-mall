import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { acceptInvite } from "@/lib/tenant/tenant-invite-service";
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant/context";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const member = await acceptInvite({
      token: parsed.data.token,
      userId: session.user.id,
    });

    try {
      await ensureBookUserGatewayIdentitySynced(session.user.id);
    } catch (e) {
      console.warn("[invite/accept] gateway identity sync failed", e);
    }

    if ((await getUserBillingPersona(session.user.id)) === "PLATFORM_CREDIT") {
      try {
        await ensurePlatformManagedKeyForUser(session.user.id);
      } catch (e) {
        console.warn("[invite/accept] platform key ensure failed", e);
      }
    }

    cookies().set(ACTIVE_TENANT_COOKIE, member.tenantId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ ok: true, tenantId: member.tenantId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "接受失败" },
      { status: 400 },
    );
  }
}
