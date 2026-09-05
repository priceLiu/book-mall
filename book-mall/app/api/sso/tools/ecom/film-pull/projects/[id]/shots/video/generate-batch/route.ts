import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomGenerateFilmPullShotsBatch } from "@/lib/ecom/ecom-film-pull-video";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { shotNos?: unknown; modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* */
  }

  const shotNos = Array.isArray(body.shotNos)
    ? body.shotNos
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.trunc(n))
    : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const batch = await ecomGenerateFilmPullShotsBatch({
      userId: auth.userId,
      projectId: id,
      shotNos,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    });
    const project = await getEcomFilmPullProject(auth.userId, id);
    return NextResponse.json({ ...batch, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量生成失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
