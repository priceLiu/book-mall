import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomGenerateFilmPullProductionImage } from "@/lib/ecom/ecom-film-pull-production-image";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string; shotNo: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, shotNo: shotNoRaw } = await ctx.params;
  const shotNo = Number.parseInt(shotNoRaw, 10);
  if (!Number.isFinite(shotNo) || shotNo < 1) {
    return NextResponse.json({ error: "无效镜号" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim() ? body.modelKey.trim() : "";
  if (!modelKey) {
    return NextResponse.json({ error: "请选择生图模型" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomGenerateFilmPullProductionImage({
      userId: auth.userId,
      projectId: id,
      shotNo,
      modelKey,
      imageSize: typeof body.imageSize === "string" ? body.imageSize : undefined,
    });
    const project = await getEcomFilmPullProject(auth.userId, id);
    return NextResponse.json({ ...result, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生图失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
