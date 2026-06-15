import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildUserByokBill } from "@/lib/billing/credit-reconciliation";
import { getActiveByokSubscription } from "@/lib/billing/byok-subscription-service";
import { BYOK_TASK_KIND_LABEL } from "@/lib/billing/byok-pricing";
import {
  TeamFinanceForbiddenError,
  assertTeamBillingView,
  currentPeriodKey,
  resolveTeamFinanceAccess,
} from "@/lib/finance/team-finance-guard";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const periodKey =
    request.nextUrl.searchParams.get("periodKey")?.trim() || currentPeriodKey();

  try {
    const access = await resolveTeamFinanceAccess(user.id, tenantId);
    if (!access.hasTeam || !access.selected) {
      return financeJson(request, { periodKey, bill: null, message: "未加入团队" });
    }
    assertTeamBillingView(access.selected.role);

    const ref = { ownerType: "TENANT" as const, ownerId: access.selected.tenantId };
    const sub = await getActiveByokSubscription(ref);
    if (!sub) {
      return financeJson(request, {
        periodKey,
        bill: null,
        message: "团队无有效 BYOK 套餐",
        tenantId: access.selected.tenantId,
      });
    }

    const techFee = 0;
    const bill = await buildUserByokBill({ ref, periodKey, techServiceFeeYuan: techFee });

    const usage = await prisma.byokUsageMonthly.findMany({
      where: { ownerType: "TENANT", ownerId: access.selected.tenantId, periodKey },
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

    const since = new Date(`${periodKey}-01T00:00:00.000Z`);
    const until = new Date(since);
    until.setUTCMonth(until.getUTCMonth() + 1);

    const memberLogs = await prisma.gatewayRequestLog.groupBy({
      by: ["actorBookUserId", "byokTaskKind"],
      where: {
        tenantId: access.selected.tenantId,
        billingMode: "BYOK",
        status: "SUCCEEDED",
        submittedAt: { gte: since, lt: until },
        byokTaskKind: { not: null },
      },
      _count: { _all: true },
    });

    const memberIds = [...new Set(memberLogs.map((m) => m.actorBookUserId).filter(Boolean))] as string[];
    const members =
      memberIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: memberIds } },
            select: { id: true, name: true, email: true, phone: true },
          })
        : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));

    const memberBreakdown = memberIds.map((uid) => {
      const rows = memberLogs.filter((m) => m.actorBookUserId === uid);
      const profile = memberMap.get(uid);
      return {
        userId: uid,
        name: profile?.name ?? null,
        email: profile?.email ?? null,
        phone: profile?.phone ?? null,
        byTaskKind: rows.map((r) => ({
          taskKind: r.byokTaskKind,
          label: r.byokTaskKind ? (BYOK_TASK_KIND_LABEL[r.byokTaskKind] ?? r.byokTaskKind) : "—",
          count: r._count._all,
        })),
      };
    });

    return financeJson(request, {
      periodKey,
      tenantId: access.selected.tenantId,
      tenantName: access.selected.tenantName,
      bill,
      usage,
      taskUsage,
      memberBreakdown,
      subscription: sub,
    });
  } catch (e) {
    if (e instanceof TeamFinanceForbiddenError) {
      return financeForbidden(request, e.message);
    }
    throw e;
  }
}
