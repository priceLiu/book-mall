import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { runFilmPullRenderScript } from "@/lib/ecom/ecom-film-pull-analyze";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { characterDescription?: unknown; modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await runFilmPullRenderScript({
      userId: auth.userId,
      projectId: id,
      characterDescription:
        typeof body.characterDescription === "string" ? body.characterDescription : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    });
    const project = await import("@/lib/ecom/ecom-film-pull-service").then((m) =>
      m.getEcomFilmPullProject(auth.userId, id),
    );
    return NextResponse.json({ result, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "渲染脚本失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
