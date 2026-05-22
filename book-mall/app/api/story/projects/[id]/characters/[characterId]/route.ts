import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import {
  deleteCharacterForUser,
  patchCharacterForUser,
} from "@/lib/story/story-project-service";

type RouteCtx = { params: Promise<{ id: string; characterId: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, characterId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const character = await patchCharacterForUser(
      guard.user.id,
      id,
      characterId,
      body.body,
    );
    return NextResponse.json({ character }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id, characterId } = await ctx.params;
  try {
    const result = await deleteCharacterForUser(guard.user.id, id, characterId);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
