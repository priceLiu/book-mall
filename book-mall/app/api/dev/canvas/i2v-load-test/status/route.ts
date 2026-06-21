import { NextResponse } from "next/server";
import { getI2vLoadTestStatus } from "@/lib/canvas/dev/i2v-load-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 开发环境：只读快照（不推进轮询）。生产返回 404。 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "missing projectId" },
      { status: 400 },
    );
  }
  try {
    const status = await getI2vLoadTestStatus(projectId);
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
