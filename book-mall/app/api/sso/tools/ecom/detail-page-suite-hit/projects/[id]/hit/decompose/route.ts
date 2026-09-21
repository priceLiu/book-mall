import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  beginHitDecomposeJob,
  decomposeDetailPageSuiteHit,
  HitDecomposeAlreadyRunningError,
  runHitDecomposePipeline,
} from "@/lib/ecom/detail-page-suite-hit/hit-decompose-service";
import { getDetailPageSuiteHitProject } from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

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
    visionModelKey: typeof body.visionModelKey === "string" ? body.visionModelKey : undefined,
    chatModelKey: typeof body.chatModelKey === "string" ? body.chatModelKey : undefined,
  };

  const asyncMode = body.async !== false;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    if (asyncMode) {
      const project = await beginHitDecomposeJob(runOpts);
      void runHitDecomposePipeline(runOpts).catch((e) => {
        console.error("[hit-decompose] background pipeline failed", id, e);
      });
      return NextResponse.json({ project, accepted: true, async: true });
    }

    const project = await decomposeDetailPageSuiteHit(runOpts);
    return NextResponse.json({ project, accepted: true, async: false });
  } catch (e) {
    if (e instanceof HitDecomposeAlreadyRunningError) {
      const project = await getDetailPageSuiteHitProject(auth.userId, id);
      return NextResponse.json({ error: e.message, project }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "拆解失败" },
      { status: 500 },
    );
  }
}
