import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { parseOutfitFromFullBodyViaGateway } from "@/lib/canvas/story-pro-character-outfit-parsing";
import { StoryProCharacterAssetError } from "@/lib/canvas/story-pro-character-asset-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const result = await parseOutfitFromFullBodyViaGateway(guard.user.id, {
      characterKey: String(body.characterKey ?? ""),
      displayName: String(body.displayName ?? ""),
      projectId: (body.projectId as string | null | undefined) ?? null,
      fullBodyUrl: String(body.fullBodyUrl ?? ""),
      sourceTaskId: (body.sourceTaskId as string | null | undefined) ?? null,
    });
    return NextResponse.json(result, { headers: jsonHeaders(request) });
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
