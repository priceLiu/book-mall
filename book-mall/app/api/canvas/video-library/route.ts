import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  deleteCanvasVideoLibraryItem,
  listCanvasVideoLibrary,
} from "@/lib/canvas/canvas-video-library-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET：当前用户视频库列表 + 配额 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const data = await listCanvasVideoLibrary(guard.user.id);
    return NextResponse.json(data, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** DELETE：?id= 删除视频库条目（含 OSS） */
export async function DELETE(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "缺少 id" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  try {
    const result = await deleteCanvasVideoLibraryItem(guard.user.id, id);
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** POST：直接写入已有 https videoUrl（少用；画布侧多用 persist-from-url） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { createCanvasVideoLibraryItem } = await import(
      "@/lib/canvas/canvas-video-library-service"
    );
    const result = await createCanvasVideoLibraryItem(
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
