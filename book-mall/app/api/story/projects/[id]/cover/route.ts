import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireStoryGatewayUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { submitCoverRegeneration, schedulePollWorkerForProject } from "@/lib/story/story-task-service";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireStoryGatewayUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const taskId = await submitCoverRegeneration(guard.user.id, id);
    schedulePollWorkerForProject(id);
    return NextResponse.json({ taskId }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
