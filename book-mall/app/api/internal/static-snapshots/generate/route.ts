/**
 * 静态页快照 · Cron/CLI 生成入口
 */
import { NextRequest, NextResponse } from "next/server";

import { authorizeInternalCron } from "@/lib/platform-assistant/internal-cron-auth";
import {
  runSiteHomeSnapshotGeneration,
  SITE_HOME_PAGE_KEY,
} from "@/lib/static-snapshots/site-home-snapshot-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handleGenerate(req: NextRequest) {
  const auth = authorizeInternalCron(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const pageKey = req.nextUrl.searchParams.get("pageKey") ?? SITE_HOME_PAGE_KEY;
  if (pageKey !== SITE_HOME_PAGE_KEY) {
    return NextResponse.json({ error: "不支持的 pageKey" }, { status: 400 });
  }

  try {
    const result = await runSiteHomeSnapshotGeneration({ trigger: "CRON" });
    return NextResponse.json({
      ok: true,
      via: auth.via,
      pageKey,
      dateKey: result.dateKey,
      summary: result.summary,
      generatedAt: result.snapshot.generatedAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[static-snapshots/generate]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  return handleGenerate(req);
}

export async function GET(req: NextRequest) {
  return handleGenerate(req);
}
