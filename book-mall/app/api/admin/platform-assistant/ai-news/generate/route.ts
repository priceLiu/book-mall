import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { runDailyAiNewsGeneration } from "@/lib/platform-assistant/ai-news-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role ?? "").toUpperCase();
  if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return null;
  }
  return session.user;
}

/** 管理驾驶舱 · 一键预生成当日热闻（无需 CRON_SECRET）。 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const result = await runDailyAiNewsGeneration();
    return NextResponse.json({
      ok: true,
      dateKey: result.dateKey,
      generatedAt: result.row.generatedAt.toISOString(),
      pruned: result.pruned,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/platform-assistant/ai-news/generate]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
