import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  setStoryProCharacterAssetLocked,
  StoryProCharacterAssetError,
} from "@/lib/canvas/story-pro-character-asset-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const { id } = await context.params;
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const asset = await setStoryProCharacterAssetLocked(
      guard.user.id,
      id,
      parsed.body.locked === true,
    );
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof StoryProCharacterAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
