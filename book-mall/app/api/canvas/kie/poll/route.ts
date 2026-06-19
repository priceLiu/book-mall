import { type NextRequest, NextResponse } from "next/server";
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";
import { getCanvasAiPollToken } from "@/lib/canvas/canvas-constants";

export const runtime = "nodejs";
/** Next.js 要求编译期字面量；默认 300s，与 poll-config 默认一致 */
export const maxDuration = 300;

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
