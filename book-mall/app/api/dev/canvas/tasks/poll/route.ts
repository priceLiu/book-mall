import { NextResponse } from "next/server";
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 开发环境一键触发：等价于 `pnpm canvas:poll-once`（无需 token） */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const summary = await runCanvasPollWorker();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...summary });
}
