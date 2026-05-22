/**
 * OSS 异步清理 worker 入口。
 * - 鉴权：与 poll 共用 STORY_AI_POLL_TOKEN
 * - 行为：扫 StoryOssCleanupQueue 中 doneAt is null AND notBefore <= now() AND attempts < 3
 *
 * 由腾讯云托管定时任务（每 60s）调用。
 */
import { type NextRequest, NextResponse } from "next/server";
import { runCleanupWorker } from "@/lib/story/story-task-service";
import { getStoryAiPollToken } from "@/lib/story/story-ai-constants";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const summary = await runCleanupWorker();
  return NextResponse.json(summary, { status: 200 });
}
