import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { listTasksForProject } from "@/lib/story/story-project-service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  try {
    const tasks = await listTasksForProject(guard.user.id, id, limit);
    return NextResponse.json({ tasks }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
