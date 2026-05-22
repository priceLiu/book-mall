import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import {
  deleteFrameForUser,
  patchFrameForUser,
} from "@/lib/story/story-project-service";

type RouteCtx = { params: Promise<{ id: string; frameId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, frameId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const frame = await patchFrameForUser(
      guard.user.id,
      id,
      frameId,
      body.body,
    );
    return NextResponse.json({ frame }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, frameId } = await ctx.params;
  try {
    const result = await deleteFrameForUser(guard.user.id, id, frameId);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
