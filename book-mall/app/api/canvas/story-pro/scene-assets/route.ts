import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listStoryProSceneAssets,
  StoryProSceneAssetError,
  upsertStoryProSceneAssetRef,
} from "@/lib/canvas/story-pro-scene-asset-service";
import type { StoryProSceneAssetRefKind } from "@prisma/client";

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const assets = await listStoryProSceneAssets(guard.user.id, {
      projectId,
    });
    return NextResponse.json({ assets }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const asset = await upsertStoryProSceneAssetRef(guard.user.id, {
      sceneKey: String(body.sceneKey ?? ""),
      displayName: String(body.displayName ?? ""),
      projectId: (body.projectId as string | null | undefined) ?? null,
      kind: (body.kind as StoryProSceneAssetRefKind | undefined) ?? "establishing",
      ossUrl: String(body.ossUrl ?? ""),
      label: (body.label as string | null | undefined) ?? null,
      sourceTaskId: (body.sourceTaskId as string | null | undefined) ?? null,
    });
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
