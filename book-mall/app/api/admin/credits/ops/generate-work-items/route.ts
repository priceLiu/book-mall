import { NextResponse, type NextRequest } from "next/server";

import { authorizeCreditOpsCron } from "@/lib/billing/credit-ops-auth";
import { generateCreditOpsWorkItems } from "@/lib/billing/credit-ops-service";

export const dynamic = "force-dynamic";

/** 生成/更新积分清零工单（Cron 00:05 或手动）。 */
async function run(req: NextRequest) {
  const auth = await authorizeCreditOpsCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const date = req.nextUrl.searchParams.get("date") ?? undefined;
  const includeOverdue = req.nextUrl.searchParams.get("includeOverdue") !== "0";

  const result = await generateCreditOpsWorkItems({ date, includeOverdue });
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
