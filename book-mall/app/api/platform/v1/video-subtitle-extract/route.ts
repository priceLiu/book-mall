import { type NextRequest, NextResponse } from "next/server";

import { runCanvasVideoSubtitleExtract } from "@/lib/canvas-video-edit/canvas-video-subtitle-extract";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
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

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  try {
    const result = await runCanvasVideoSubtitleExtract({
      userId: user.id,
      projectId,
      sourceVideoUrl,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json(
        { error: e.message, message: e.message },
        { status: e.httpStatus },
      );
    }
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json({ error: e.userMessage }, { status: 503 });
    }
    const message =
      e instanceof Error ? e.message : "提取字幕失败";
    return NextResponse.json({ error: message, message }, { status: 422 });
  }
}
