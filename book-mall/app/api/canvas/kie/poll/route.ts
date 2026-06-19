import { type NextRequest, NextResponse } from "next/server";
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";
import { getCanvasAiPollToken } from "@/lib/canvas/canvas-constants";
import { getGenerationPollMaxDurationSec } from "@/lib/generation/poll-config";

export const runtime = "nodejs";
export const maxDuration = getGenerationPollMaxDurationSec();

export async function POST(request: NextRequest) {
  const expected = getCanvasAiPollToken();
  if (!expected) {
    return NextResponse.json(
      { error: "POLL_TOKEN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runCanvasPollWorker();
  return NextResponse.json(summary, { status: 200 });
}
