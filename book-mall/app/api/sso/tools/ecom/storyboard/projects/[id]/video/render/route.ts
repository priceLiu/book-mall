import { MediaRenderSourceApp } from "@prisma/client";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ECOM_STORYBOARD_MODULE } from "@/lib/ecom/ecom-storyboard-types";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { fromEcomStoryboardSheet } from "@/lib/media/timeline-adapters";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
  getMediaRenderJobForUser,
} from "@/lib/media/media-render-service";
import { parseRenderProfile } from "@/lib/media/timeline-types";
import { prisma } from "@/lib/prisma";
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

  let profile = parseRenderProfile(null);
  try {
    const raw = await req.json().catch(() => ({}));
    profile = parseRenderProfile(raw.profile);
  } catch {
    /* use default */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const timeline = fromEcomStoryboardSheet(project.sheet);
    if (timeline.clips.length < 2) {
      return NextResponse.json(
        { error: "请至少为 2 个镜头生成分镜视频后再合并" },
        { status: 400 },
      );
    }

    const job = await createMediaRenderJob({
      userId: auth.userId,
      sourceApp: MediaRenderSourceApp.ecom,
      sourceRef: { projectId, title: project.sheet.overview.title },
      timeline,
      profile,
    });
    enqueueMediaRenderJob(job.id);

    const existing = await prisma.ecomStoryboardProject.findFirst({
      where: { id: projectId },
      select: { meta: true },
    });
    const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
    await prisma.ecomStoryboardProject.update({
      where: { id: projectId },
      data: {
        meta: {
          ...prevMeta,
          workflow: {
            ...((prevMeta.workflow as Record<string, unknown> | undefined) ?? {}),
            phase: "rendering",
            videoMode: "merged_panels",
            renderJobId: job.id,
          },
        } as Prisma.InputJsonValue,
      },
    });

    const dto = await getMediaRenderJobForUser(job.id, auth.userId);
    return NextResponse.json({ job: dto });
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json(
        { error: e.code, message: e.userMessage },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "视频合并失败";
    const status = /不能超过|至少需要|须为 HTTPS|过长|2 个镜头/.test(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
