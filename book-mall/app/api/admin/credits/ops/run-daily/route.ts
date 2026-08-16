import { NextResponse, type NextRequest } from "next/server";

import { authorizeCreditOpsCron } from "@/lib/billing/credit-ops-auth";
import {
  runDailyExpireSweepOps,
  runDailySubscriptionResetOps,
  cstBusinessDate,
} from "@/lib/billing/credit-ops-service";
import type { RunCreditOpsPhase } from "@/lib/billing/credit-ops-service";

export const dynamic = "force-dynamic";

/** 统一执行积分清零任务（Cron / 手动）。 */
async function run(req: NextRequest) {
  const auth = await authorizeCreditOpsCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const phase = (req.nextUrl.searchParams.get("phase") ?? "all") as RunCreditOpsPhase;
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const onlyOverdue = req.nextUrl.searchParams.get("onlyOverdue") === "1";
  const date = req.nextUrl.searchParams.get("date") ?? cstBusinessDate();

  if (phase === "expire") {
    const result = await runDailyExpireSweepOps({ dryRun, trigger: "CRON" });
    return NextResponse.json({ ok: true, phase, date, ...result, at: new Date().toISOString() });
  }

  if (phase === "reset") {
    const result = await runDailySubscriptionResetOps({ dryRun, onlyOverdue, trigger: "CRON" });
    return NextResponse.json({ ok: true, phase, date, ...result, at: new Date().toISOString() });
  }

  const expireResult = dryRun
    ? await runDailyExpireSweepOps({ dryRun: true, trigger: "CRON" })
    : await runDailyExpireSweepOps({ trigger: "CRON" });
  const resetResult = dryRun
    ? await runDailySubscriptionResetOps({ dryRun: true, onlyOverdue, trigger: "CRON" })
    : await runDailySubscriptionResetOps({ onlyOverdue, trigger: "CRON" });

  return NextResponse.json({
    ok: true,
    phase: "all",
    date,
    expire: expireResult,
    reset: resetResult,
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
