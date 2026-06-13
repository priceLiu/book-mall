import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getProjectAsset,
  ProjectAssetError,
} from "@/lib/project-asset/project-asset-service";
import { mapProjectAssetToCanvasInsert } from "@/lib/project-asset/project-asset-insert-map";

type RouteCtx = { params: { id: string } };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const edition = String(parsed.body.edition ?? "pro2") as
      | "pro"
      | "pro2"
      | "sbv1"
      | "standard";
    const asset = await getProjectAsset(guard.user.id, ctx.params.id);
    const insert = mapProjectAssetToCanvasInsert(asset, { edition });
    return NextResponse.json({ insert }, { headers: jsonHeaders(request) });
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
