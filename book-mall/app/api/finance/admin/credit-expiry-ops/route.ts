import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  getCreditOpsAlerts,
  getCreditOpsDashboard,
  listCreditOpsJobRuns,
  listCreditOpsWorkItems,
  runCreditOpsJob,
  runDailyExpireSweepOps,
  runDailySubscriptionResetOps,
  generateCreditOpsWorkItems,
  cstBusinessDate,
} from "@/lib/billing/credit-ops-service";
import type { CreditOpsWorkStatus, CreditOpsWorkType } from "@prisma/client";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

async function requireFinance(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return { error: financeUnauthorized(request) };
  if (!canViewFinanceCost(user.role)) {
    return { error: financeForbidden(request, "需要财务权限") };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireFinance(request);
  if (auth.error) return auth.error;

  const view = request.nextUrl.searchParams.get("view") ?? "dashboard";
  const date = request.nextUrl.searchParams.get("date") ?? undefined;

  if (view === "alerts") {
    const alerts = await getCreditOpsAlerts();
    const overdueCount = alerts.find((a) => a.code === "OVERDUE_ITEMS")?.value ?? 0;
    return financeJson(request, { alerts, overdueCount });
  }

  if (view === "work-items") {
    const status = request.nextUrl.searchParams.get("status") as CreditOpsWorkStatus | null;
    const workType = request.nextUrl.searchParams.get("workType") as CreditOpsWorkType | null;
    const q = request.nextUrl.searchParams.get("q") ?? undefined;
    const take = Number(request.nextUrl.searchParams.get("take") ?? 50);
    const skip = Number(request.nextUrl.searchParams.get("skip") ?? 0);
    const data = await listCreditOpsWorkItems({
      date,
      status: status ?? undefined,
      workType: workType ?? undefined,
      q,
      take,
      skip,
    });
    return financeJson(request, data);
  }

  if (view === "job-runs") {
    const take = Number(request.nextUrl.searchParams.get("take") ?? 20);
    const runs = await listCreditOpsJobRuns(take);
    return financeJson(request, { runs });
  }

  const dashboard = await getCreditOpsDashboard({ date });
  const alerts = await getCreditOpsAlerts();
  return financeJson(request, { dashboard, alerts });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinance(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "preview" | "run-today" | "backfill-overdue" | "backfill-items";
    phase?: "expire" | "reset" | "all";
    workItemIds?: string[];
    date?: string;
    generateFirst?: boolean;
  };

  const mode = body.mode ?? "run-today";
  const phase = body.phase ?? "all";
  const dryRun = mode === "preview";
  const date = body.date ?? cstBusinessDate();
  const userId = auth.user!.id;

  if (body.generateFirst !== false) {
    await generateCreditOpsWorkItems({ date, includeOverdue: true });
  }

  if (mode === "backfill-items" && body.workItemIds?.length) {
    const result = await runCreditOpsJob({
      jobType: "MANUAL_BACKFILL",
      phase,
      trigger: "ADMIN",
      triggeredByUserId: userId,
      workItemIds: body.workItemIds,
      dryRun,
    });
    return financeJson(request, { ok: true, mode, result });
  }

  if (mode === "backfill-overdue") {
    const expireResult =
      phase === "reset"
        ? null
        : await runCreditOpsJob({
            jobType: "MANUAL_BACKFILL",
            phase: "expire",
            trigger: "ADMIN",
            triggeredByUserId: userId,
            onlyOverdue: true,
            dryRun,
          });
    const resetResult =
      phase === "expire"
        ? null
        : await runCreditOpsJob({
            jobType: "MANUAL_BACKFILL",
            phase: "reset",
            trigger: "ADMIN",
            triggeredByUserId: userId,
            onlyOverdue: true,
            dryRun,
          });
    return financeJson(request, { ok: true, mode, expireResult, resetResult });
  }

  if (phase === "expire") {
    const expireResult = await runDailyExpireSweepOps({
      dryRun,
      trigger: "ADMIN",
      triggeredByUserId: userId,
    });
    return financeJson(request, { ok: true, mode, expireResult });
  }

  if (phase === "reset") {
    const resetResult = await runDailySubscriptionResetOps({
      dryRun,
      trigger: "ADMIN",
      triggeredByUserId: userId,
    });
    return financeJson(request, { ok: true, mode, resetResult });
  }

  const expireResult = await runDailyExpireSweepOps({
    dryRun,
    trigger: "ADMIN",
    triggeredByUserId: userId,
  });
  const resetResult = await runDailySubscriptionResetOps({
    dryRun,
    trigger: "ADMIN",
    triggeredByUserId: userId,
  });
  return financeJson(request, { ok: true, mode, expireResult, resetResult });
}
