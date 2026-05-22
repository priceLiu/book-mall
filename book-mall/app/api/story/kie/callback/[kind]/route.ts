/**
 * KIE 回调入口（image / video）。
 * - 校验 query token = KIE_CALLBACK_TOKEN（启用回调时必填）
 * - 校验 query taskRef → StoryGenerationTask.id
 * - body 同 recordInfo 响应（{ data: {...record} }）
 * - 始终返回 200，避免 KIE 重试风暴；内部失败 log + markFailed
 *
 * 详见 plan.md §6.2 / story-ai-pipeline.md §3
 */
import { type NextRequest, NextResponse } from "next/server";
import { applyKieTaskResult } from "@/lib/story/story-task-service";
import { logKieEvent, type KieRecordResponse } from "@/lib/story/kie-client";
import { getStoryAiKieCallbackToken } from "@/lib/story/story-ai-constants";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ kind: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { kind } = await ctx.params;
  if (kind !== "image" && kind !== "video") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const expectedToken = getStoryAiKieCallbackToken();
  if (!expectedToken) {
    logKieEvent("warn", "callback token not configured; ignoring callback");
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const taskRef = url.searchParams.get("taskRef");
  if (queryToken !== expectedToken) {
    logKieEvent("warn", "callback token mismatch", { taskRef });
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
    await applyKieTaskResult(taskRef, data);
  } catch (e) {
    logKieEvent("error", "applyKieTaskResult threw in callback", {
      taskRef,
      error: e instanceof Error ? e.message : String(e),
    });
    // 仍返回 200 给 KIE，避免重试风暴
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
