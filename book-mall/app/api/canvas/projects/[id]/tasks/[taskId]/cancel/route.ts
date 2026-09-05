import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { cancelCanvasGenerationTask } from "@/lib/canvas/canvas-task-service";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** POST：用户中止进行中的画布生成任务 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId, taskId } = await ctx.params;
  try {
    const result = await cancelCanvasGenerationTask({
      userId: guard.user.id,
      projectId,
      taskId,
    });
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
