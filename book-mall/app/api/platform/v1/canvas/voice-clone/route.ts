import { type NextRequest, NextResponse } from "next/server";

import { runCanvasVoiceClone } from "@/lib/canvas/canvas-voice-clone-service";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
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

  const referenceAudioUrl =
    typeof body.referenceAudioUrl === "string" ? body.referenceAudioUrl.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";

  try {
    const result = await runCanvasVoiceClone(user.id, {
      referenceAudioUrl,
      prompt,
      title,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof CanvasProjectError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.httpStatus },
      );
    }
    console.error("[canvas/voice-clone] failed", e);
    return NextResponse.json(
      { error: "INTERNAL", message: e instanceof Error ? e.message : "克隆失败" },
      { status: 500 },
    );
  }
}
