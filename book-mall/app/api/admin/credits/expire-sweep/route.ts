import { NextResponse, type NextRequest } from "next/server";

import { authorizeCreditOpsCron } from "@/lib/billing/credit-ops-auth";
import { runDailyExpireSweepOps } from "@/lib/billing/credit-ops-service";

export const dynamic = "force-dynamic";

/** 积分批次到期清扫（兼容入口 → ops 层 + 工单回写）。 */
async function run(req: NextRequest) {
  const auth = await authorizeCreditOpsCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const result = await runDailyExpireSweepOps({ dryRun, trigger: "CRON" });
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
