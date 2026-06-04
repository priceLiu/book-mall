import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { EcomBillingMode } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import {
  getUserEcomBillingMode,
  setUserEcomBillingMode,
} from "@/lib/ecom/ecom-billing-mode";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const raw = body.ecomBillingMode;
  if (raw !== "BYOK_SERVICE_FEE" && raw !== "PLATFORM_METERED") {
    return NextResponse.json({ error: "无效模式" }, { status: 400 });
  }
  const updated = await setUserEcomBillingMode(
    session.user.id,
    raw as EcomBillingMode,
  );
  return NextResponse.json({ ecomBillingMode: updated });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const mode = await getUserEcomBillingMode(session.user.id);
  return NextResponse.json({ ecomBillingMode: mode });
}
