import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 30 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(m: string): string {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "bin";
}

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** POST multipart/form-data：field "file" → 上传到 OSS，返回 ossUrl */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "INVALID_CONTENT_TYPE" },
      { status: 415, headers: jsonHeaders(request) },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "INVALID_FORM" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "FILE_REQUIRED" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "FILE_TOO_LARGE", message: `max ${MAX_BYTES} bytes` },
      { status: 413, headers: jsonHeaders(request) },
    );
  }
  const mime = file.type.toLowerCase();
  if (!ACCEPTED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "UNSUPPORTED_MIME", mime },
      { status: 415, headers: jsonHeaders(request) },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const ossUrl = await uploadCanvasUserBuffer({
      buf,
      contentType: mime,
      userId: guard.user.id,
      ext: extForMime(mime),
    });
    return NextResponse.json(
      { ossUrl },
      { headers: jsonHeaders(request) },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[canvas-uploads] oss upload failed", msg);
    return NextResponse.json(
      { error: "OSS_UPLOAD_FAILED", message: msg },
      { status: 502, headers: jsonHeaders(request) },
    );
  }
}
