import { NextResponse } from "next/server";
import { tickI2vLoadTest } from "@/lib/canvas/dev/i2v-load-test";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 开发环境：推进一次轮询（dispatch + poll worker），返回最新快照。 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  let projectId = url.searchParams.get("projectId") ?? "";
  if (!projectId) {
    try {
      const body = (await request.json()) as { projectId?: string };
      projectId = body.projectId ?? "";
    } catch {
      /* noop */
    }
  }
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "missing projectId" },
      { status: 400 },
    );
  }
  try {
    const status = await tickI2vLoadTest(projectId);
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
