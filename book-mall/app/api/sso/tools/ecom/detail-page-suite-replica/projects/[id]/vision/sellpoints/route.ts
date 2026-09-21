import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  beginReplicaVisionSellpointJob,
  ReplicaVisionSellpointAlreadyRunningError,
  runReplicaVisionSellpointPipeline,
} from "@/lib/ecom/detail-page-suite-replica/replica-vision-sellpoint-service";
import { getDetailPageSuiteReplicaProject } from "@/lib/ecom/detail-page-suite/project-service";
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
      const project = await beginReplicaVisionSellpointJob(runOpts);
      void runReplicaVisionSellpointPipeline(runOpts).catch((e) => {
        console.error("[replica-vision-sellpoints] background pipeline failed", id, e);
      });
      return NextResponse.json({ project, accepted: true, async: true });
    }

    await beginReplicaVisionSellpointJob(runOpts);
    const project = await runReplicaVisionSellpointPipeline(runOpts);
    return NextResponse.json({ project, accepted: true, async: false });
  } catch (e) {
    if (e instanceof ReplicaVisionSellpointAlreadyRunningError) {
      const project = await getDetailPageSuiteReplicaProject(auth.userId, id);
      return NextResponse.json({ error: e.message, project }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "识图失败" },
      { status: 500 },
    );
  }
}
