import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomModelShotProject } from "@/lib/ecom/ecom-model-shot-service";
import { persistModelShotDeliverableSnapshot } from "@/lib/ecom/ecom-model-shot-snapshot";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 保存服装模特图完整工作流镜像到资产库 */
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
  const workName = typeof body.workName === "string" ? body.workName.trim() : "";
  if (!workName) {
    return NextResponse.json({ error: "请填写作品名" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const snapshot = await persistModelShotDeliverableSnapshot({
      userId: auth.userId,
      projectId,
      workName,
    });
    const refreshed = await getEcomModelShotProject(auth.userId, projectId);
    return NextResponse.json({ snapshot, project: refreshed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    const status =
      message === "项目不存在" ? 404 : message.includes("请先") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
