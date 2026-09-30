import { type NextRequest, NextResponse } from "next/server";

import {
  runCanvasVideoFrameExtract,
  type CanvasVideoFrameExtractMode,
} from "@/lib/canvas-video-edit/canvas-video-frame-extract";
import { userFacingCanvasVideoEditError } from "@/lib/canvas-video-edit/canvas-video-edit-shared";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import { resolvePlatformUser } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODES = new Set<CanvasVideoFrameExtractMode>(["first", "last", "at"]);

export async function POST(request: NextRequest) {
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!MODES.has(modeRaw as CanvasVideoFrameExtractMode)) {
    return NextResponse.json(
      { error: "mode 须为 first、last 或 at" },
      { status: 400 },
    );
  }
  const mode = modeRaw as CanvasVideoFrameExtractMode;

  const sourceVideoUrl =
    typeof body.sourceVideoUrl === "string" ? body.sourceVideoUrl.trim() : "";
  if (!sourceVideoUrl) {
    return NextResponse.json({ error: "sourceVideoUrl 必填" }, { status: 400 });
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  const atSec =
    body.atSec != null && body.atSec !== ""
      ? Number(body.atSec)
      : undefined;

  try {
    const result = await runCanvasVideoFrameExtract({
      userId: user.id,
      projectId,
      sourceVideoUrl,
      mode,
      atSec,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json({ error: e.userMessage }, { status: 503 });
    }
    const message =
      e instanceof Error
        ? userFacingCanvasVideoEditError(e.message)
        : "截帧失败";
    return NextResponse.json({ error: message, message }, { status: 422 });
  }
}
