import { type NextRequest, NextResponse } from "next/server";
import { applyCanvasKieTaskResult } from "@/lib/canvas/canvas-task-service";
import { getCanvasAiKieCallbackToken } from "@/lib/canvas/canvas-constants";
import { logKieEvent, type KieRecordResponse } from "@/lib/story/kie-client";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ kind: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { kind } = await ctx.params;
  if (kind !== "image" && kind !== "text" && kind !== "video") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  const expectedToken = getCanvasAiKieCallbackToken();
  if (!expectedToken) {
    logKieEvent("warn", "[canvas] callback token not configured; ignoring callback");
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const taskRef = url.searchParams.get("taskRef");
  if (queryToken !== expectedToken) {
    logKieEvent("warn", "[canvas] callback token mismatch", { taskRef });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!taskRef) {
    return NextResponse.json({ error: "taskRef_required" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const data = (body as { data?: KieRecordResponse }).data;
  if (!data || !data.taskId || !data.state) {
    return NextResponse.json({ ok: true, note: "no usable data" }, { status: 200 });
  }
  try {
    await applyCanvasKieTaskResult(taskRef, data);
  } catch (e) {
    logKieEvent("error", "[canvas] applyCanvasKieTaskResult threw in callback", {
      taskRef,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
