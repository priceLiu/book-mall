import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { createUserPropEntry } from "@/lib/ecom/ecom-prop-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const visualDescription =
      typeof body.visualDescription === "string" ? body.visualDescription.trim() : "";
    if (!name || !visualDescription) {
      return NextResponse.json({ error: "name、visualDescription 必填" }, { status: 400 });
    }
    const entry = await createUserPropEntry(auth.userId, { name, visualDescription });
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
