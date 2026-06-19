/**
 * KIE 轮询 worker 入口。
 * - 鉴权：Authorization: Bearer ${STORY_AI_POLL_TOKEN}
 * - 行为：扫一次 PENDING + SUBMITTED 任务（详见 story-task-service.runPollWorker）
 *
 * 由腾讯云托管定时任务（每 30s）+ 本地 `pnpm story:poll-once` 调用。
 */
import { type NextRequest, NextResponse } from "next/server";
import { runPollWorker } from "@/lib/story/story-task-service";
import { getStoryAiPollToken } from "@/lib/story/story-ai-constants";

export const runtime = "nodejs";
/** Next.js 要求编译期字面量；默认 300s，与 poll-config 默认一致 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const expected = getStoryAiPollToken();
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
  const summary = await runPollWorker();
  return NextResponse.json(summary, { status: 200 });
}
