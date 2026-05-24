import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getCanvasProjectForUser,
  softDeleteCanvasProjectForUser,
  updateCanvasProjectForUser,
} from "@/lib/canvas/canvas-project-service";
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const inflight = await prisma.canvasGenerationTask.count({
      where: {
        projectId: id,
        project: { userId: guard.user.id, deletedAt: null },
        status: { in: ["PENDING", "SUBMITTED"] },
      },
    });
    if (inflight > 0) {
      try {
        await runCanvasPollWorker({ projectId: id });
      } catch (e) {
        console.warn("[canvas/project GET] opportunistic poll failed", e);
      }
    }
    const project = await getCanvasProjectForUser(guard.user.id, id);
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  try {
    const project = await updateCanvasProjectForUser(guard.user.id, id, {
      name: typeof body.body.name === "string" ? body.body.name : undefined,
      description:
        typeof body.body.description === "string"
          ? body.body.description
          : undefined,
      canvas: body.body.canvas,
      thumbnailUrl:
        typeof body.body.thumbnailUrl === "string"
          ? body.body.thumbnailUrl
          : undefined,
    });
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    await softDeleteCanvasProjectForUser(guard.user.id, id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
