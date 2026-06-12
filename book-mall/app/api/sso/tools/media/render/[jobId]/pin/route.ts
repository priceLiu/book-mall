import { NextResponse } from "next/server";

import { ECOM_STORYBOARD_MODULE } from "@/lib/ecom/ecom-storyboard-types";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { pinMediaRenderJob } from "@/lib/media/media-render-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    title?: string;
  };

  try {
    let createEcomAsset:
      | { module: string; title: string; meta?: Record<string, unknown> }
      | undefined;
    if (body.projectId) {
      const project = await getEcomStoryboardProject(auth.userId, body.projectId);
      if (project?.sheet) {
        createEcomAsset = {
          module: ECOM_STORYBOARD_MODULE,
          title: (body.title ?? project.sheet.overview.title).slice(0, 80),
          meta: {
            projectId: body.projectId,
            kind: "merged_panel_video_pinned",
            renderJobId: jobId,
          },
        };
      }
    }

    const job = await pinMediaRenderJob({
      userId: auth.userId,
      jobId,
      createEcomAsset,
    });
    return NextResponse.json({ job });
  } catch (e) {
    const message = e instanceof Error ? e.message : "延期保留失败";
    const status = /容量包|不足|过期|不存在/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
