import { NextResponse } from "next/server";
import { startGenLoadTest } from "@/lib/canvas/dev/gen-load-test";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

/** 开发环境：5 条画布文本 + 5 条画布生图，同时进 Gateway。 */
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
    const result = await startGenLoadTest({
      userId: typeof body.userId === "string" ? body.userId : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
