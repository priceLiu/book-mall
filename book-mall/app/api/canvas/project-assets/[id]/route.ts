import { type NextRequest, NextResponse } from "next/server";
import type { AssetVisibility } from "@prisma/client";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  deleteProjectAsset,
  getProjectAsset,
  patchProjectAsset,
  ProjectAssetError,
} from "@/lib/project-asset/project-asset-service";

type RouteCtx = { params: { id: string } };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const asset = await getProjectAsset(guard.user.id, ctx.params.id);
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof ProjectAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const asset = await patchProjectAsset(guard.user.id, ctx.params.id, {
      displayName: body.displayName as string | undefined,
      description: body.description as string | undefined,
      visibility: body.visibility as AssetVisibility | undefined,
      locked: body.locked as boolean | undefined,
      payload: body.payload as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof ProjectAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const result = await deleteProjectAsset(guard.user.id, ctx.params.id);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof ProjectAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
