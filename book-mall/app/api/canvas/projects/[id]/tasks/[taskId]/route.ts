import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { softDeleteCanvasTask } from "@/lib/canvas/canvas-task-service";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId, taskId } = await ctx.params;
  try {
    await softDeleteCanvasTask({
      userId: guard.user.id,
      projectId,
      taskId,
    });
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
