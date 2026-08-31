import { NextResponse } from "next/server";

import {
  filmPullAnalyzeToPro2ProductionScript,
  filmPullRenderScriptToPro2ProductionScript,
} from "@/lib/ecom/adapters/ecom-film-pull-to-pro2-script";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { title?: unknown; preferRenderScript?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomFilmPullProject(auth.userId, id);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

    const title = typeof body.title === "string" ? body.title : project.title ?? undefined;
    const preferRender = body.preferRenderScript !== false;
    const render = project.renderScript?.structured;
    const analyze = project.analyzeResult?.structured;

    let productionScript;
    if (preferRender && render) {
      productionScript = filmPullRenderScriptToPro2ProductionScript(render, { title });
    } else if (analyze) {
      productionScript = filmPullAnalyzeToPro2ProductionScript(analyze, { title });
    } else {
      return NextResponse.json({ error: "请先完成拉片" }, { status: 400 });
    }

    return NextResponse.json({ productionScript, projectId: id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
