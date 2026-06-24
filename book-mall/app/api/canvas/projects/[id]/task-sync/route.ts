import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import { getCanvasProjectTaskSyncSnapshot } from "@/lib/canvas/canvas-task-event-stream";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 轻量 JSON 快照（替代 SSE，避免浏览器 tab 长连接一直转圈） */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const { id: projectId } = await ctx.params;
  try {
    await assertAccessibleCanvasProject(guard.user.id, projectId);
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }

  try {
    const snap = await getCanvasProjectTaskSyncSnapshot(projectId);
    return NextResponse.json(
      { projectId, ...snap },
      { headers: jsonHeaders(request) },
    );
  } catch {
    return NextResponse.json(
      { error: "snapshot_failed", projectId },
      { status: 503, headers: jsonHeaders(request) },
    );
  }
}
