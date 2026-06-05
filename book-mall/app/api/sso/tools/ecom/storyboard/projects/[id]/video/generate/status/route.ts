import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { ecomPollStoryboardFullVideoJob } from "@/lib/ecom/ecom-storyboard-video";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** 轮询整图成片 Gateway 任务（单次） */
export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  const project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project?.sheet) {
    return NextResponse.json({ error: "请先生成分镜故事版" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomPollStoryboardFullVideoJob({
      userId: auth.userId,
      projectId,
      sheet: project.sheet,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "视频轮询失败";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
