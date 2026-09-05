import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { createUserPoseEntry } from "@/lib/ecom/ecom-pose-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const category = typeof body.category === "string" ? body.category.trim().toUpperCase() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const baseDescription =
      typeof body.baseDescription === "string" ? body.baseDescription.trim() : "";
    if (!category || !title || !baseDescription) {
      return NextResponse.json(
        { error: "category、title、baseDescription 必填" },
        { status: 400 },
      );
    }
    const entry = await createUserPoseEntry(auth.userId, {
      category,
      title,
      baseDescription,
    });
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
