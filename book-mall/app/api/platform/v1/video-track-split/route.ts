import { type NextRequest, NextResponse } from "next/server";

import {
  runCanvasVideoTrackSplit,
  userFacingVideoTrackSplitError,
  type CanvasVideoTrackSplitMode,
} from "@/lib/canvas-video-edit/canvas-video-track-split";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import { resolvePlatformUser } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODES = new Set<CanvasVideoTrackSplitMode>(["strip-audio", "extract-audio"]);

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
  if (!MODES.has(modeRaw as CanvasVideoTrackSplitMode)) {
    return NextResponse.json(
      { error: "mode 须为 strip-audio 或 extract-audio" },
      { status: 400 },
    );
  }
  const mode = modeRaw as CanvasVideoTrackSplitMode;

  const sourceVideoUrl =
    typeof body.sourceVideoUrl === "string" ? body.sourceVideoUrl.trim() : "";
  if (!sourceVideoUrl) {
    return NextResponse.json({ error: "sourceVideoUrl 必填" }, { status: 400 });
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  try {
    const result = await runCanvasVideoTrackSplit({
      userId: user.id,
      projectId,
      sourceVideoUrl,
      mode,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json({ error: e.userMessage }, { status: 503 });
    }
    const message = userFacingVideoTrackSplitError(
      e instanceof Error ? e.message : "视频处理失败",
    );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
