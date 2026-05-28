import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  deleteStoryProCharacterAssetRef,
  StoryProCharacterAssetError,
} from "@/lib/canvas/story-pro-character-asset-service";

type RouteContext = { params: Promise<{ refId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const { refId } = await context.params;
    const asset = await deleteStoryProCharacterAssetRef(guard.user.id, refId);
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
