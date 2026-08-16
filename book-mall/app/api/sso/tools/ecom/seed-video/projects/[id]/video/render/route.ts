import { MediaRenderSourceApp } from "@prisma/client";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomSeedVideoProject, updateEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { fromEcomSeedVideoPlan } from "@/lib/media/timeline-adapters";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
  getMediaRenderJobForUser,
} from "@/lib/media/media-render-service";
import { parseRenderProfile } from "@/lib/media/timeline-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  const project = await getEcomSeedVideoProject(auth.userId, projectId);
  const shots = project?.plan?.shots ?? [];
  if (shots.length === 0) {
    return NextResponse.json({ error: "请先完成镜头表并生成各镜视频" }, { status: 400 });
  }
  const missingVideo = shots.filter((s) => !s.videoUrl?.trim());
  if (missingVideo.length > 0) {
    return NextResponse.json({ error: "请先为各镜生成镜头视频后再合成" }, { status: 400 });
  }
  const missingTts = shots.filter(
    (s) => s.videoUrl?.trim() && s.voiceover?.trim() && !s.ttsUrl?.trim(),
  );
  if (missingTts.length > 0) {
    return NextResponse.json(
      { error: "请先批量 TTS，待各镜口播就绪后再合成成片" },
      { status: 400 },
    );
  }

  let profile = parseRenderProfile(null);
  try {
    const raw = await req.json().catch(() => ({}));
    profile = parseRenderProfile(raw.profile);
  } catch {
    /* default */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const timeline = fromEcomSeedVideoPlan(shots);
    if (timeline.clips.length < 1) {
      return NextResponse.json({ error: "请至少生成 1 个镜头视频后再合成" }, { status: 400 });
    }

    const job = await createMediaRenderJob({
      userId: auth.userId,
      sourceApp: MediaRenderSourceApp.ecom,
      sourceRef: { projectId, title: project?.title ?? "种草视频" },
      timeline,
      profile: {
        ...profile,
        audio: { ...profile.audio, mixTts: true },
        subtitle: { ...profile.subtitle, mode: "script", burnIn: true },
      },
    });
    enqueueMediaRenderJob(job.id);

    await updateEcomSeedVideoProject(auth.userId, projectId, {
      plan: { render: { jobId: job.id } },
      meta: { workflow: { phase: "production" } },
      status: "rendering",
    });

    return NextResponse.json({ jobId: job.id, expiresAt: job.expiresAt.toISOString() });
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
  const { id: projectId } = await ctx.params;

  const project = await getEcomSeedVideoProject(auth.userId, projectId);
  const jobId = project?.plan?.render?.jobId;
  if (!jobId) return NextResponse.json({ status: "idle" });

  const job = await getMediaRenderJobForUser(auth.userId, jobId);
  if (!job) return NextResponse.json({ status: "idle" });

  if (job.status === "SUCCEEDED" && job.downloadUrl) {
    await updateEcomSeedVideoProject(auth.userId, projectId, {
      plan: {
        render: {
          jobId,
          finalVideoUrl: job.downloadUrl,
        },
      },
      status: "done",
      meta: { workflow: { phase: "done" } },
    });
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
