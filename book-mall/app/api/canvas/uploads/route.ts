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
const ACCEPTED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/x-m4a",
]);
const ACCEPTED_TEXT_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/octet-stream",
]);

function extForMime(m: string, fileName?: string): string {
  const lower = (fileName ?? "").toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  if (m === "text/markdown") return "md";
  if (m === "text/plain") return "txt";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m.startsWith("audio/")) {
    if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
    if (m.includes("wav")) return "wav";
    if (m.includes("ogg")) return "ogg";
    if (m.includes("aac") || m.includes("m4a") || m.includes("mp4")) return "m4a";
    if (m.includes("webm")) return "webm";
  }
  return "bin";
}

function isAudioUpload(mime: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".aac") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".webm")
  ) {
    return true;
  }
  return ACCEPTED_AUDIO_MIME.has(mime.toLowerCase());
}

function isTextUpload(mime: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt")
  ) {
    return true;
  }
  return ACCEPTED_TEXT_MIME.has(mime.toLowerCase());
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
  const fileName = file.name.trim();
  const textUpload = isTextUpload(mime, fileName);
  const audioUpload = isAudioUpload(mime, fileName);
  if (!textUpload && !audioUpload && !ACCEPTED_IMAGE_MIME.has(mime)) {
    return NextResponse.json(
      { error: "UNSUPPORTED_MIME", mime },
      { status: 415, headers: jsonHeaders(request) },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (textUpload) {
    const sample = buf.subarray(0, Math.min(buf.length, 4096)).toString("utf8");
    if (sample.includes("\0")) {
      return NextResponse.json(
        { error: "INVALID_TEXT", message: "binary content in text file" },
        { status: 400, headers: jsonHeaders(request) },
      );
    }
  }
  try {
    const ossUrl = await uploadCanvasUserBuffer({
      buf,
      contentType: textUpload
        ? mime === "text/markdown"
          ? "text/markdown; charset=utf-8"
          : "text/plain; charset=utf-8"
        : audioUpload && !mime.startsWith("audio/")
          ? "audio/mpeg"
          : mime,
      userId: guard.user.id,
      ext: extForMime(mime, fileName),
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
