import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import {
  getProjectDetail,
  patchProjectForUser,
  softDeleteProjectForUser,
} from "@/lib/story/story-project-service";
import { runPollWorker } from "@/lib/story/story-task-service";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const inflight = await prisma.storyGenerationTask.count({
      where: {
        projectId: id,
        project: { userId: guard.user.id, deletedAt: null },
        status: { in: ["PENDING", "SUBMITTED"] },
      },
    });
    if (inflight > 0) {
      try {
        await runPollWorker({ projectId: id });
      } catch (e) {
        console.warn("[story/project GET] opportunistic poll failed", e);
      }
    }
    const project = await getProjectDetail(guard.user.id, id);
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const project = await patchProjectForUser(guard.user.id, id, body.body);
    return NextResponse.json({ project }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const result = await softDeleteProjectForUser(guard.user.id, id);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
