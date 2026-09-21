import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { HitDecomposeAlreadyRunningError } from "@/lib/ecom/detail-page-suite-hit/hit-decompose-service";
import {
  applyHitTemplateEdit,
  resetHitTemplateToSnapshot,
} from "@/lib/ecom/detail-page-suite-hit/hit-rewrite-service";
import { getDetailPageSuiteHitProject } from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (body.reset === true) {
      const project = await resetHitTemplateToSnapshot({
        userId: auth.userId,
        projectId: id,
      });
      return NextResponse.json({ project });
    }
    if (body.template == null) {
      return NextResponse.json({ error: "template 必填" }, { status: 400 });
    }
    const project = await applyHitTemplateEdit({
      userId: auth.userId,
      projectId: id,
      template: body.template,
    });
    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof HitDecomposeAlreadyRunningError) {
      const project = await getDetailPageSuiteHitProject(auth.userId, id);
      return NextResponse.json({ error: e.message, project }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存结构失败" },
      { status: 500 },
    );
  }
}
