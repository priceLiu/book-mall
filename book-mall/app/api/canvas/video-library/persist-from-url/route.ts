import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { persistCanvasVideoLibraryFromUrl } from "@/lib/canvas/canvas-video-library-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** POST：从临时 URL 转存 OSS 并写入视频库 */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const result = await persistCanvasVideoLibraryFromUrl(
      guard.user.id,
      body.body as Record<string, unknown>,
    );
    return NextResponse.json(result, {
      status: 201,
      headers: jsonHeaders(request),
    });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
