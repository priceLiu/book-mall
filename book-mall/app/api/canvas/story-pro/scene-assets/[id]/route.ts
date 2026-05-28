import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  setStoryProSceneAssetLocked,
  StoryProSceneAssetError,
} from "@/lib/canvas/story-pro-scene-asset-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const { id } = await context.params;
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const asset = await setStoryProSceneAssetLocked(
      guard.user.id,
      id,
      parsed.body.locked === true,
    );
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof StoryProSceneAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
