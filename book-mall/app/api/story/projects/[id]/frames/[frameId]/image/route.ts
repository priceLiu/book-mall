import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireStoryGatewayUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { submitFrameImage, schedulePollWorkerForProject } from "@/lib/story/story-task-service";

type RouteCtx = { params: Promise<{ id: string; frameId: string }> };

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireStoryGatewayUser(request);
  if (!guard.ok) return guard.response;
  const { id, frameId } = await ctx.params;
  try {
    const taskId = await submitFrameImage(guard.user.id, id, frameId);
    schedulePollWorkerForProject(id);
    return NextResponse.json({ taskId }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
