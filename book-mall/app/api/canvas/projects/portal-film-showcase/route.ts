import { type NextRequest, NextResponse } from "next/server";

import { listPortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
} from "@/lib/canvas/api-helpers";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 门户影视案例：分镜视频 1.0 已入库图片/视频（公开，无需登录） */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("limit");
    const limit = raw ? Number.parseInt(raw, 10) : undefined;
    const items = await listPortalFilmShowcaseMedia(
      Number.isFinite(limit) ? limit : undefined,
    );
    return NextResponse.json({ items }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
