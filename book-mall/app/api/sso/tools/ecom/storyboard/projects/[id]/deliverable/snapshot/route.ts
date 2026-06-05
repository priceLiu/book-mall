import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { persistStoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 手动保存当前项目为交付快照（只读查阅） */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project?.sheet) {
    return NextResponse.json({ error: "请先生成分镜内容" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const videoMode =
      body.videoMode === "merged_panels" || body.videoMode === "full_sheet"
        ? body.videoMode
        : ((project.meta?.workflow as { videoMode?: string } | undefined)?.videoMode as
            | "merged_panels"
            | "full_sheet"
            | undefined);

    const snapshot = await persistStoryboardDeliverableSnapshot({
      userId: auth.userId,
      projectId,
      videoMode,
    });

    if (!snapshot) {
      return NextResponse.json({ error: "快照保存失败" }, { status: 500 });
    }

    const refreshed = await getEcomStoryboardProject(auth.userId, projectId);
    return NextResponse.json({ snapshot, project: refreshed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "快照保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
