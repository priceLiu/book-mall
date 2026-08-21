/**
 * AI 小智 · 热闻预生成（Cron / CLI 专用，全平台唯一写入口）。
 */
import { NextRequest, NextResponse } from "next/server";

import { runDailyAiNewsGeneration } from "@/lib/platform-assistant/ai-news-service";
import { authorizeInternalCron } from "@/lib/platform-assistant/internal-cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = authorizeInternalCron(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await runDailyAiNewsGeneration();
    return NextResponse.json({
      ok: true,
      via: auth.via,
      dateKey: result.dateKey,
      generatedAt: result.row.generatedAt.toISOString(),
      pruned: result.pruned,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[platform-assistant/ai-news/generate]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

/** CloudBase / curl GET 兼容 */
export async function GET(req: NextRequest) {
  return POST(req);
}
