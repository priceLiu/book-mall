import { NextResponse, type NextRequest } from "next/server";

import { authorizeCreditOpsCron } from "@/lib/billing/credit-ops-auth";
import { runDailySubscriptionResetOps } from "@/lib/billing/credit-ops-service";

export const dynamic = "force-dynamic";

/** 订阅积分周期重置（兼容入口 → ops 层 + 工单回写）。 */
async function run(req: NextRequest) {
  const auth = await authorizeCreditOpsCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const onlyOverdue = req.nextUrl.searchParams.get("onlyOverdue") === "1";
  const result = await runDailySubscriptionResetOps({ dryRun, onlyOverdue, trigger: "CRON" });
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
