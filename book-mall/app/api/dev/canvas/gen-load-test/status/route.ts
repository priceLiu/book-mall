import { NextResponse } from "next/server";
import { getGenLoadTestStatus, tickGenLoadTest } from "@/lib/canvas/dev/gen-load-test";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "缺少 projectId" }, { status: 400 });
  }
  try {
    const status = await getGenLoadTestStatus(projectId);
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "缺少 projectId" }, { status: 400 });
  }
  try {
    const status = await tickGenLoadTest(projectId);
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
