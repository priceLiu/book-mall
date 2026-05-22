import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { submitCharacterAvatar } from "@/lib/story/story-task-service";

type RouteCtx = { params: Promise<{ id: string; characterId: string }> };

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, characterId } = await ctx.params;
  try {
    const taskId = await submitCharacterAvatar(guard.user.id, id, characterId);
    return NextResponse.json({ taskId }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
