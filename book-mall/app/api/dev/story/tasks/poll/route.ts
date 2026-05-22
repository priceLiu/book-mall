import { NextResponse } from "next/server";
import { runPollWorker } from "@/lib/story/story-task-service";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 开发环境一键触发：等价于 `pnpm story:poll-once`（无需 STORY_AI_POLL_TOKEN） */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const summary = await runPollWorker();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...summary });
}
