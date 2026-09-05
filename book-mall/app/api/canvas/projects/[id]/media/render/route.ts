import {
  MediaRenderSourceApp,
} from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import type { JianyingFrameInput } from "@/lib/canvas/canvas-jianying-export";
import { CanvasProjectError, getCanvasProjectForUser } from "@/lib/canvas/canvas-project-service";
import { hydrateJianyingRenderFrameAudioUrls } from "@/lib/canvas/hydrate-jianying-render-frames";
import { mapBillingFailureForGatewayLog } from "@/lib/billing/billing-failure-map";
import { InsufficientCreditsError } from "@/lib/billing/credit-account-service";
import { fromCanvasJianyingFrames } from "@/lib/media/timeline-adapters";
import {
  buildPendingMediaRenderJobDto,
  createMediaRenderJob,
  enqueueMediaRenderJob,
  getMediaRenderJobForUser,
} from "@/lib/media/media-render-service";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import { mediaRenderErrorMessage } from "@/lib/media/media-render-errors";
import { parseRenderProfile } from "@/lib/media/timeline-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const frames = body.body.frames as JianyingFrameInput[] | undefined;
  if (!Array.isArray(frames) || frames.length === 0) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "body.frames required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }

  try {
    const project = await getCanvasProjectForUser(guard.user.id, projectId);
    const canvasNodes =
      (
        project.canvas as {
          nodes?: Array<{ id: string; type?: string; data?: Record<string, unknown> }>;
        }
      ).nodes ?? [];
    const hydratedFrames = await hydrateJianyingRenderFrameAudioUrls({
      userId: guard.user.id,
      projectId,
      frames: frames as JianyingFrameInput[],
      canvasNodes,
    });
    const profile = parseRenderProfile(body.body.profile);
    if (profile.audio?.mixTts) {
      const videoFramesWithAudio = hydratedFrames.filter(
        (f) => f.audioSourceNodeId?.trim() && f.videoUrl?.trim(),
      );
      const missingAudio = videoFramesWithAudio.filter(
        (f) => !f.audioUrl?.trim(),
      );
      if (missingAudio.length > 0) {
        return NextResponse.json(
          {
            error: "AUDIO_HYDRATE_FAILED",
            message: `已勾选「烧录对白」，但有 ${missingAudio.length} 镜配音未能同步到云端。请确认 TTS 已生成完成，稍候重试；若仍失败请重新生成配音后再提交。`,
          },
          { status: 400, headers: jsonHeaders(request) },
        );
      }
    }
    const timeline = fromCanvasJianyingFrames(hydratedFrames);
    const replaceInFlight = body.body.replaceInFlight === true;
    const job = await createMediaRenderJob({
      userId: guard.user.id,
      sourceApp: MediaRenderSourceApp.canvas,
      sourceRef: { projectId },
      timeline,
      profile,
      replaceInFlight,
    });
    if (!job.reusedExisting) {
      enqueueMediaRenderJob(job.id);
      return NextResponse.json(
        {
          job: buildPendingMediaRenderJobDto({
            id: job.id,
            userId: guard.user.id,
            expiresAt: job.expiresAt,
          }),
        },
        { headers: jsonHeaders(request) },
      );
    }
    const dto = await getMediaRenderJobForUser(job.id, guard.user.id);
    if (!dto) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "剪辑任务不存在" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json({ job: dto }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof CanvasProjectError) {
      return canvasErrorToResponse(request, err);
    }
    if (err instanceof MediaRenderUnavailableError) {
      return NextResponse.json(
        { error: err.code, message: err.userMessage },
        { status: 503, headers: jsonHeaders(request) },
      );
    }
    if (err instanceof InsufficientCreditsError) {
      const mapped = mapBillingFailureForGatewayLog(err);
      return NextResponse.json(
        { error: mapped.failCode, message: mapped.failMessage },
        { status: 402, headers: jsonHeaders(request) },
      );
    }
    const message = mediaRenderErrorMessage(err);
    const status = /不能超过|至少需要|须为 HTTPS|过长|重启/.test(message)
      ? 400
      : 500;
    return NextResponse.json(
      { error: "RENDER_FAILED", message },
      { status, headers: jsonHeaders(request) },
    );
  }
}
