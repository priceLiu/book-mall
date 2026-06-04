import { NextResponse } from "next/server";
import type { EcomBillingMode } from "@prisma/client";
import {
  getUserEcomBillingMode,
  setUserEcomBillingMode,
} from "@/lib/ecom/ecom-billing-mode";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseMode(raw: unknown): EcomBillingMode | null {
  if (raw === "BYOK_SERVICE_FEE" || raw === "PLATFORM_METERED") return raw;
  return null;
}

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (auth.ok) {
    const mode = await getUserEcomBillingMode(auth.userId);
    return NextResponse.json({ ecomBillingMode: mode });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const mode = await getUserEcomBillingMode(session.user.id);
  return NextResponse.json({ ecomBillingMode: mode });
}

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
  const mode = parseMode(body.ecomBillingMode);
  if (!mode) {
    return NextResponse.json({ error: "无效的 ecomBillingMode" }, { status: 400 });
  }
  const updated = await setUserEcomBillingMode(session.user.id, mode);
  return NextResponse.json({ ecomBillingMode: updated });
}
