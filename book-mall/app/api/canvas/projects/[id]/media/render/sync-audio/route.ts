import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { ensureCanvasAudioNodeHttpsUrl } from "@/lib/canvas/ensure-canvas-audio-oss-url";
import { CanvasProjectError, getCanvasProjectForUser } from "@/lib/canvas/canvas-project-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 自动成片 · 提交前同步单镜 TTS 配音到 OSS（B 方案：客户端逐镜调此接口并展示进度） */
export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const audioSourceNodeId = String(body.body.audioSourceNodeId ?? "").trim();
  if (!audioSourceNodeId) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "body.audioSourceNodeId required" },
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

    const audioUrl = await ensureCanvasAudioNodeHttpsUrl({
      userId: guard.user.id,
      projectId,
      nodeId: audioSourceNodeId,
      canvasNodes,
    });

    if (!audioUrl?.trim()) {
      return NextResponse.json(
        {
          error: "AUDIO_SYNC_FAILED",
          message:
            "该镜配音未能同步到云端。请确认 TTS 已生成完成，稍候重试；若仍失败请重新生成配音。",
        },
        { status: 400, headers: jsonHeaders(request) },
      );
    }

    return NextResponse.json(
      { audioUrl: audioUrl.trim() },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    if (err instanceof CanvasProjectError) {
      return canvasErrorToResponse(request, err);
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "AUDIO_SYNC_FAILED", message },
      { status: 500, headers: jsonHeaders(request) },
    );
  }
}
