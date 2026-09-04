import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getEcomOutfitVideoProject,
  renderEcomOutfitVideo,
  syncEcomOutfitVideoRenderResult,
} from "@/lib/ecom/ecom-outfit-video-service";
import { getMediaRenderJobForUser } from "@/lib/media/media-render-service";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await renderEcomOutfitVideo(auth.userId, id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "合成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const project = await getEcomOutfitVideoProject(auth.userId, id);
  const jobId =
    typeof project?.meta?.renderJobId === "string" ? project.meta.renderJobId.trim() : "";
  if (!jobId) return NextResponse.json({ status: "idle" });

  const job = await getMediaRenderJobForUser(jobId, auth.userId);
  if (!job) return NextResponse.json({ status: "idle" });

  if (job.status === "SUCCEEDED" && job.downloadUrl) {
    await syncEcomOutfitVideoRenderResult(auth.userId, id);
  }

  return NextResponse.json({
    status: job.status.toLowerCase(),
    jobId,
    progress: job.progress,
    progressLabel: job.progressLabel ?? undefined,
    outputUrl: job.downloadUrl ?? undefined,
    failMessage: job.errorMessage ?? undefined,
  });
}
