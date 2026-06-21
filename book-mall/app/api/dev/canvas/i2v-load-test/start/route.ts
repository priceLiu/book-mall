import { NextResponse } from "next/server";
import { startI2vLoadTest } from "@/lib/canvas/dev/i2v-load-test";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 开发环境：创建并发起 N 条图生视频任务（Seedance 2.0）。生产返回 404。 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    const result = await startI2vLoadTest({
      userId: typeof body.userId === "string" ? body.userId : undefined,
      count: typeof body.count === "number" ? body.count : undefined,
      durationSec:
        typeof body.durationSec === "number" ? body.durationSec : undefined,
      resolution:
        body.resolution === "1080p" || body.resolution === "720p"
          ? body.resolution
          : undefined,
      generateAudio: body.generateAudio === true,
      aspectRatio:
        typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
