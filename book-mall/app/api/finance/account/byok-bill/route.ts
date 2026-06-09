import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildUserByokBill } from "@/lib/billing/credit-reconciliation";
import { getActiveByokSubscription } from "@/lib/billing/byok-subscription-service";
import { BYOK_TASK_KIND_LABEL } from "@/lib/billing/byok-pricing";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const periodKey =
    request.nextUrl.searchParams.get("periodKey")?.trim() || currentPeriodKey();

  const sub = await getActiveByokSubscription({ ownerType: "USER", ownerId: user.id });
  if (!sub) {
    return financeJson(request, { periodKey, bill: null, message: "无有效 BYOK 套餐" });
  }

  const techFee = Number(sub.techServiceFeeYuan) * (sub.seats || 1);
  const bill = await buildUserByokBill({
    ref: { ownerType: "USER", ownerId: user.id },
    periodKey,
    techServiceFeeYuan: techFee,
  });

  const usage = await prisma.byokUsageMonthly.findMany({
    where: {
      ownerType: "USER",
      ownerId: user.id,
      periodKey,
    },
  });

  const quotas = await prisma.byokTaskQuota.findMany({
    where: { scopeKey: sub.scopeKey, active: true },
    orderBy: { taskKind: "asc" },
  });

  const seatMultiplier = sub.scopeKey === "team-seat" ? Math.max(1, sub.seats || 1) : 1;
  const usageByKind = new Map(usage.map((u) => [u.taskKind, u]));

  const taskUsage = quotas.map((q) => {
    const row = usageByKind.get(q.taskKind);
    const monthlyIncluded = q.monthlyIncluded * seatMultiplier;
    const includedUsed = row?.includedUsed ?? 0;
    const overageUsed = row?.overageUsed ?? 0;
    return {
      taskKind: q.taskKind,
      label: BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label,
      monthlyIncluded,
      includedUsed,
      includedRemaining: Math.max(0, monthlyIncluded - includedUsed),
      overageUsed,
      overageCredits: row?.overageCredits ?? 0,
      overageCreditsPerTask: q.overageCredits,
    };
  });

  return financeJson(request, { periodKey, bill, usage, taskUsage, subscription: sub });
}
