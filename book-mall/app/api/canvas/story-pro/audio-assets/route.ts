import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listStoryProCharacterAudioAssets,
  setStoryProCharacterAudioAssetLocked,
  StoryProAudioAssetError,
  upsertStoryProCharacterAudioAsset,
} from "@/lib/canvas/story-pro-audio-asset-service";

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const assets = await listStoryProCharacterAudioAssets(guard.user.id, {
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
    const asset = await upsertStoryProCharacterAudioAsset(guard.user.id, {
      characterKey: String(body.characterKey ?? ""),
      displayName: String(body.displayName ?? ""),
      projectId: (body.projectId as string | null | undefined) ?? null,
      voiceLabel: (body.voiceLabel as string | null | undefined) ?? null,
      voiceId: (body.voiceId as string | null | undefined) ?? null,
      sampleOssUrl: (body.sampleOssUrl as string | null | undefined) ?? null,
      notes: (body.notes as string | null | undefined) ?? null,
    });
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof StoryProAudioAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const assetId = String(body.assetId ?? "");
    const locked = Boolean(body.locked);
    const asset = await setStoryProCharacterAudioAssetLocked(
      guard.user.id,
      assetId,
      locked,
    );
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof StoryProAudioAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
