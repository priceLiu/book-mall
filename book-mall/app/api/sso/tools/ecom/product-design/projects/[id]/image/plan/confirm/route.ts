import { NextResponse } from "next/server";

import { confirmImageGenPlan } from "@/lib/ecom/ecom-product-design-image-plan";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const target = body.target === "detail" ? "detail" : "main";

  try {
    const result = await confirmImageGenPlan({
      userId: auth.userId,
      projectId: id,
      target,
    });
    return NextResponse.json({ plan: result.plan, project: result.project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "确认失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
