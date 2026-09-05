import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { persistProductDesignWorkflowSnapshot } from "@/lib/ecom/ecom-product-design-snapshot";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 保存完整工作流镜像到资产库（按主图/详情页类目展示） */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const productName = typeof body.productName === "string" ? body.productName.trim() : "";
  if (!productName) {
    return NextResponse.json({ error: "请填写产品名" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const snapshot = await persistProductDesignWorkflowSnapshot({
      userId: auth.userId,
      projectId,
      productName,
    });
    return NextResponse.json({ snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    const status =
      message === "项目不存在" ? 404 : message.includes("请先") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
