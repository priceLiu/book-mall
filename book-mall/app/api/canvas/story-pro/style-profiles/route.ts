import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  listStoryProStyleProfiles,
  setStoryProStyleProfileLocked,
  StoryProStyleProfileError,
  upsertStoryProStyleProfile,
} from "@/lib/canvas/story-pro-style-profile-service";

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const profiles = await listStoryProStyleProfiles(guard.user.id, {
      projectId,
    });
    return NextResponse.json({ profiles }, { headers: jsonHeaders(request) });
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
    const profile = await upsertStoryProStyleProfile(guard.user.id, {
      projectId: (body.projectId as string | null | undefined) ?? null,
      profileKey: (body.profileKey as string | undefined) ?? "default",
      displayName: String(body.displayName ?? "项目风格"),
      mainStyle: (body.mainStyle as string | null | undefined) ?? null,
      colorTone: (body.colorTone as string | null | undefined) ?? null,
      renderQuality: (body.renderQuality as string | null | undefined) ?? null,
      anchorZh: (body.anchorZh as string | null | undefined) ?? null,
      anchorEn: (body.anchorEn as string | null | undefined) ?? null,
      negativePrompt: (body.negativePrompt as string | null | undefined) ?? null,
      refImageUrls: Array.isArray(body.refImageUrls)
        ? (body.refImageUrls as string[])
        : [],
    });
    return NextResponse.json({ profile }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof StoryProStyleProfileError) {
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
    const profileId = String(body.profileId ?? "");
    const locked = Boolean(body.locked);
    const profile = await setStoryProStyleProfileLocked(
      guard.user.id,
      profileId,
      locked,
    );
    return NextResponse.json({ profile }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof StoryProStyleProfileError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
