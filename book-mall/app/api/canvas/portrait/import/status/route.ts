import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getCanvasPortraitImportStatus,
  type CanvasPortraitKind,
} from "@/lib/canvas/canvas-portrait-import-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 查询人像素材处理状态（GetAsset） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const assetId = request.nextUrl.searchParams.get("assetId")?.trim() ?? "";
    const kind = (request.nextUrl.searchParams.get("kind")?.trim() ??
      "virtual") as CanvasPortraitKind;
    const edition =
      request.nextUrl.searchParams.get("edition")?.trim() === "pro2"
        ? "pro2"
        : "sbv1";
    const projectId =
      request.nextUrl.searchParams.get("projectId")?.trim() || undefined;
    const result = await getCanvasPortraitImportStatus({
      userId: guard.user.id,
      assetId,
      kind,
      edition,
      projectId,
    });
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
