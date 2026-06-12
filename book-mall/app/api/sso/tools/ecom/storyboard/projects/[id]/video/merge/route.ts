import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { ecomMergeStoryboardPanelVideos } from "@/lib/ecom/ecom-storyboard-video";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  const project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project?.sheet) {
    return NextResponse.json({ error: "请先生成分镜脚本" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomMergeStoryboardPanelVideos({
      userId: auth.userId,
      projectId,
      sheet: project.sheet,
      title: project.sheet.overview.title,
    });
    return NextResponse.json({
      jobId: result.jobId,
      ossUrl: result.ossUrl,
      expiresAt: result.expiresAt,
      asset: result.asset,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "视频合并失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
