import { MediaRenderSourceApp } from "@prisma/client";
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
import { fromCanvasJianyingFrames } from "@/lib/media/timeline-adapters";
import {
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
    await getCanvasProjectForUser(guard.user.id, projectId);
    const timeline = fromCanvasJianyingFrames(frames);
    const profile = parseRenderProfile(body.body.profile);
    const job = await createMediaRenderJob({
      userId: guard.user.id,
      sourceApp: MediaRenderSourceApp.canvas,
      sourceRef: { projectId },
      timeline,
      profile,
    });
    enqueueMediaRenderJob(job.id);
    const dto = await getMediaRenderJobForUser(job.id, guard.user.id);
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
