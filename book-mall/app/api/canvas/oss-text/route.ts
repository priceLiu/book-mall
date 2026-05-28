import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  assertCanvasUserUploadOssUrl,
  readCanvasUserUploadText,
} from "@/lib/canvas/canvas-user-oss-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET ?url=… — 服务端读取本用户 canvas/user-upload 文本（规避浏览器 CORS） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const rawUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) {
    return NextResponse.json(
      { error: "URL_REQUIRED" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }

  try {
    assertCanvasUserUploadOssUrl(rawUrl, guard.user.id);
    const text = await readCanvasUserUploadText(rawUrl);
    return NextResponse.json({ text }, { headers: jsonHeaders(request) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      msg === "FORBIDDEN_OSS_URL" || msg === "FORBIDDEN_OSS_HOST"
        ? 403
        : msg === "INVALID_OSS_URL"
          ? 400
          : msg.startsWith("OSS_READ_HTTP_")
            ? 502
            : 502;
    return NextResponse.json(
      { error: msg, message: msg },
      { status, headers: jsonHeaders(request) },
    );
  }
}
