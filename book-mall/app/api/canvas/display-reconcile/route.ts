import { type NextRequest, NextResponse } from "next/server";

import { getCanvasAiPollToken } from "@/lib/canvas/canvas-constants";
import { runCanvasDisplayReconcileWorker } from "@/lib/canvas/canvas-video-display-recover";

export const runtime = "nodejs";
/** 与 canvas/kie/poll 对齐，允许批量扫描 + 写回 */
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

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit =
    limitRaw && /^\d+$/.test(limitRaw)
      ? Math.min(Math.max(Number(limitRaw), 1), 200)
      : 40;

  const summary = await runCanvasDisplayReconcileWorker({ limit });
  return NextResponse.json(summary, { status: 200 });
}
