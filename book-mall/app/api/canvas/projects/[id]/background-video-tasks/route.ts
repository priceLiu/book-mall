import { type NextRequest, NextResponse } from "next/server";

import {
  listCanvasProjectBackgroundVideoTasks,
  VIDEO_BACKGROUND_GENERATION_LABEL,
} from "@/lib/canvas/canvas-background-video-tasks";
import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { VIDEO_BACKGROUND_UI_SEC } from "@/lib/gateway/video-task-wait-policy";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 项目内 · 持续后台生成 / 可恢复误杀 的视频任务列表（只读，不阻塞） */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;

  const tasks = await listCanvasProjectBackgroundVideoTasks({
    userId: guard.user.id,
    projectId,
  });

  return NextResponse.json(
    {
      tasks,
      config: {
        backgroundWaitSec: VIDEO_BACKGROUND_UI_SEC,
        backgroundLabel: VIDEO_BACKGROUND_GENERATION_LABEL,
      },
    },
    { headers: jsonHeaders(request) },
  );
}

/** 恢复单条后台/误杀视频到节点（非阻塞：内部 poll 厂商有超时） */
export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;

  const body = (await request.json().catch(() => null)) as {
    taskId?: string;
  } | null;
  const taskId = body?.taskId?.trim();
  if (!taskId) {
    return NextResponse.json(
      { error: "缺少 taskId" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }

  const owned = await listCanvasProjectBackgroundVideoTasks({
    userId: guard.user.id,
    projectId,
  });
  if (!owned.some((t) => t.taskId === taskId)) {
    return NextResponse.json(
      { error: "任务不存在或无需恢复" },
      { status: 404, headers: jsonHeaders(request) },
    );
  }

  const result = await recoverCanvasVideoTaskDisplay(taskId);
  return NextResponse.json(
    { ok: result.ok, result },
    { status: result.ok ? 200 : 409, headers: jsonHeaders(request) },
  );
}
