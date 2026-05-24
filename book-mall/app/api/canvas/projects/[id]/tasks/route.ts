import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listProjectTasks,
  runCanvasPollWorker,
} from "@/lib/canvas/canvas-task-service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  const url = new URL(request.url);
  const nodeIdsParam = url.searchParams.get("nodeIds");
  const nodeIds = nodeIdsParam
    ? nodeIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  try {
    const inflight = await prisma.canvasGenerationTask.count({
      where: {
        projectId,
        project: { userId: guard.user.id, deletedAt: null },
        status: { in: ["PENDING", "SUBMITTED"] },
      },
    });
    if (inflight > 0) {
      try {
        await runCanvasPollWorker({ projectId });
      } catch (e) {
        console.warn("[canvas/tasks GET] opportunistic poll failed", e);
      }
    }
    const tasks = await listProjectTasks({
      userId: guard.user.id,
      projectId,
      nodeIds,
    });
    return NextResponse.json({ tasks }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
