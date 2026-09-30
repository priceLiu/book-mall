import { type NextRequest, NextResponse } from "next/server";

import { runCanvasVideoTrim } from "@/lib/canvas-video-edit/canvas-video-trim";
import { userFacingCanvasVideoEditError } from "@/lib/canvas-video-edit/canvas-video-edit-shared";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import { resolvePlatformUser } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const sourceVideoUrl =
    typeof body.sourceVideoUrl === "string" ? body.sourceVideoUrl.trim() : "";
  if (!sourceVideoUrl) {
    return NextResponse.json({ error: "sourceVideoUrl 必填" }, { status: 400 });
  }

  const startSec = Number(body.startSec);
  const endSec = Number(body.endSec);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return NextResponse.json(
      { error: "startSec 与 endSec 必填且须为数字" },
      { status: 400 },
    );
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  try {
    const result = await runCanvasVideoTrim({
      userId: user.id,
      projectId,
      sourceVideoUrl,
      startSec,
      endSec,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json({ error: e.userMessage }, { status: 503 });
    }
    const message =
      e instanceof Error
        ? userFacingCanvasVideoEditError(e.message)
        : "裁剪失败";
    return NextResponse.json({ error: message, message }, { status: 422 });
  }
}
