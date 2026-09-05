import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { isFilmPullMockAllowed } from "@/lib/ecom/ecom-film-pull-mock";
import { applyFilmPullProductionAssemble } from "@/lib/ecom/ecom-film-pull-production-assemble";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!isFilmPullMockAllowed()) {
    return NextResponse.json({ error: "Mock 未启用" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const productionPlan = await applyFilmPullProductionAssemble(auth.userId, id);
    const project = await getEcomFilmPullProject(auth.userId, id);
    return NextResponse.json({ productionPlan, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 组装失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
