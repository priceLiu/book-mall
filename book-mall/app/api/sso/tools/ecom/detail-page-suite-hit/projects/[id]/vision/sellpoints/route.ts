import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  beginHitVisionSellpointJob,
  HitVisionSellpointAlreadyRunningError,
  runHitVisionSellpointPipeline,
  visionSellpointsForHitProjectSync,
} from "@/lib/ecom/detail-page-suite-hit/hit-vision-sellpoint-service";
import { getDetailPageSuiteHitProject } from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

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

  const runOpts = {
    userId: auth.userId,
    projectId: id,
    modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
  };
  const asyncMode = body.async !== false;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    if (asyncMode) {
      const project = await beginHitVisionSellpointJob(runOpts);
      void runHitVisionSellpointPipeline(runOpts).catch((e) => {
        console.error("[hit-vision-sellpoints] background pipeline failed", id, e);
      });
      return NextResponse.json({ project, accepted: true, async: true });
    }

    const project = await visionSellpointsForHitProjectSync(runOpts);
    return NextResponse.json({ project, accepted: true, async: false });
  } catch (e) {
    if (e instanceof HitVisionSellpointAlreadyRunningError) {
      const project = await getDetailPageSuiteHitProject(auth.userId, id);
      return NextResponse.json({ error: e.message, project }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "识图失败" },
      { status: 500 },
    );
  }
}
