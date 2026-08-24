/**
 * 积分清零运维台 · 工单生成、批量执行、对账与看板。
 * 业务规则不变，包装 credit-account-service 现有清零函数。
 * 见 docs/积分清零控制台.md
 */
import type {
  CreditOpsJobTrigger,
  CreditOpsJobType,
  CreditOpsWorkStatus,
  CreditOpsWorkType,
  CreditSource,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  evaluateCreditOpsAlerts,
  type CreditOpsAlert,
  type CreditOpsJobRunSummary,
} from "@/lib/billing/credit-ops-alerts";
import {
  expireDueLotsForAccount,
  resetMonthlyCredits,
} from "@/lib/billing/credit-account-service";
import {
  subscriptionCreditPeriodEnd,
  subscriptionCreditPeriodKey,
} from "@/lib/billing/credit-lot-logic";
import { isMembershipServiceActive } from "@/lib/billing/membership-service-period";
import {
  cstBusinessDate,
  cstDayEndUtc,
  cstDayStartUtc,
} from "@/lib/billing/cst-business-date";

export { cstBusinessDate, cstDayEndUtc, cstDayStartUtc } from "@/lib/billing/cst-business-date";


/** dev 热更新后 Prisma Client 可能未含 CreditOps 模型；避免整页崩溃。 */
export function isCreditOpsPrismaReady(): boolean {
  const p = prisma as unknown as { creditOpsWorkItem?: { count?: unknown } };
  return typeof p.creditOpsWorkItem?.count === "function";
}

export type CreditOpsDashboardSnapshot = {
  date: string;
  prismaReady: boolean;
  opsHealth: "healthy" | "warn" | "critical" | "offline";
  pending: number;
  overdue: number;
  /** 与 processedToday 相同；保留字段供旧 UI 兼容 */
  doneToday: number;
  processedToday: number;
  backfilledToday: number;
  totalDone: number;
  skippedToday: number;
  failedToday: number;
  staleSubscriptionLotAccounts: number;
  driftCount: number;
  cronRanToday: { expire: boolean; reset: boolean };
  lastJobs: Array<{
    id: string;
    jobType: string;
    scheduledDate: string;
    trigger: string;
    status: string;
    statsJson: unknown;
    startedAt: Date;
    finishedAt: Date | null;
    errorSummary: string | null;
  }>;
};

function computeOpsHealth(input: {
  prismaReady: boolean;
  overdue: number;
  failedToday: number;
  staleSubscriptionLotAccounts: number;
  driftCount: number;
  alerts: CreditOpsAlert[];
}): CreditOpsDashboardSnapshot["opsHealth"] {
  if (!input.prismaReady) return "offline";
  if (
    input.overdue > 0 ||
    input.failedToday > 0 ||
    input.alerts.some((a) => a.level === "CRITICAL")
  ) {
    return "critical";
  }
  if (
    input.driftCount > 0 ||
    input.staleSubscriptionLotAccounts > 0 ||
    input.alerts.some((a) => a.level === "WARN")
  ) {
    return "warn";
  }
  return "healthy";
}

export function emptyCreditOpsDashboard(date?: string): CreditOpsDashboardSnapshot {
  return {
    date: date ?? cstBusinessDate(),
    prismaReady: false,
    opsHealth: "offline",
    pending: 0,
    overdue: 0,
    doneToday: 0,
    processedToday: 0,
    backfilledToday: 0,
    totalDone: 0,
    skippedToday: 0,
    failedToday: 0,
    staleSubscriptionLotAccounts: 0,
    driftCount: 0,
    cronRanToday: { expire: false, reset: false },
    lastJobs: [],
  };
}

type WorkItemUpsert = {
  workType: CreditOpsWorkType;
  dueDate: string;
  dueAt: Date;
  accountId: string;
  ownerType: "USER" | "TENANT";
  ownerId: string;
  ownerHint: string | null;
  source: CreditSource | null;
  periodKey: string;
  expectedExpireCredits: number;
  expectedGrantCredits: number;
};

async function resolveOwnerHints(
  refs: Array<{ ownerType: "USER" | "TENANT"; ownerId: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const userIds = refs.filter((r) => r.ownerType === "USER").map((r) => r.ownerId);
  const tenantIds = refs.filter((r) => r.ownerType === "TENANT").map((r) => r.ownerId);
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { id: true, phone: true, email: true, name: true },
    });
    for (const u of users) {
      out.set(`USER:${u.id}`, u.phone ?? u.email ?? u.name ?? u.id);
    }
  }
  if (tenantIds.length > 0) {
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: [...new Set(tenantIds)] } },
      select: { id: true, name: true },
    });
    for (const t of tenants) {
      out.set(`TENANT:${t.id}`, t.name);
    }
  }
  return out;
}

async function upsertWorkItems(items: WorkItemUpsert[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const item of items) {
    const existing = await prisma.creditOpsWorkItem.findUnique({
      where: {
        workType_accountId_dueDate_periodKey: {
          workType: item.workType,
          accountId: item.accountId,
          dueDate: item.dueDate,
          periodKey: item.periodKey,
        },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === "DONE" || existing.status === "SKIPPED") {
        updated += 1;
        continue;
      }
      await prisma.creditOpsWorkItem.update({
        where: { id: existing.id },
        data: {
          dueAt: item.dueAt,
          ownerHint: item.ownerHint,
          expectedExpireCredits: item.expectedExpireCredits,
          expectedGrantCredits: item.expectedGrantCredits,
          source: item.source,
        },
      });
      updated += 1;
    } else {
      await prisma.creditOpsWorkItem.create({ data: item });
      created += 1;
    }
  }
  return { created, updated };
}

/** 将 PENDING 且 dueDate < today 升级为 OVERDUE。 */
export async function promoteOverdueWorkItems(now: Date = new Date()): Promise<number> {
  const today = cstBusinessDate(now);
  const res = await prisma.creditOpsWorkItem.updateMany({
    where: { status: "PENDING", dueDate: { lt: today } },
    data: { status: "OVERDUE" },
  });
  return res.count;
}

/** 扫描并 upsert 今日 / 逾期工单。 */
export async function generateCreditOpsWorkItems(input?: {
  date?: string;
  includeOverdue?: boolean;
  now?: Date;
}): Promise<{ created: number; updated: number; promoted: number }> {
  const now = input?.now ?? new Date();
  const date = input?.date ?? cstBusinessDate(now);
  const includeOverdue = input?.includeOverdue ?? true;
  const dayStart = cstDayStartUtc(date);
  const dayEnd = cstDayEndUtc(date);
  const today = cstBusinessDate(now);

  const items: WorkItemUpsert[] = [];

  // —— BATCH_EXPIRE：按 lot 聚合 ——
  const lotWhere = includeOverdue
    ? {
        remainingCredits: { gt: 0 },
        expiresAt: { not: null },
        OR: [
          { expiresAt: { gte: dayStart, lte: dayEnd } },
          ...(date <= today ? [{ expiresAt: { lt: cstDayStartUtc(today) } }] : []),
        ],
      }
    : {
        remainingCredits: { gt: 0 },
        expiresAt: { gte: dayStart, lte: dayEnd },
      };

  const lots = await prisma.creditLot.findMany({
    where: lotWhere,
    select: {
      accountId: true,
      source: true,
      remainingCredits: true,
      expiresAt: true,
      account: { select: { ownerType: true, ownerId: true } },
    },
  });

  const lotGroups = new Map<string, WorkItemUpsert>();
  for (const lot of lots) {
    if (!lot.expiresAt) continue;
    const dueDate = cstBusinessDate(lot.expiresAt);
    const key = `BATCH_EXPIRE:${lot.accountId}:${dueDate}:${lot.source}`;
    const prev = lotGroups.get(key);
    if (prev) {
      prev.expectedExpireCredits += lot.remainingCredits;
    } else {
      lotGroups.set(key, {
        workType: "BATCH_EXPIRE",
        dueDate,
        dueAt: lot.expiresAt,
        accountId: lot.accountId,
        ownerType: lot.account.ownerType,
        ownerId: lot.account.ownerId,
        ownerHint: null,
        source: lot.source,
        periodKey: "",
        expectedExpireCredits: lot.remainingCredits,
        expectedGrantCredits: 0,
      });
    }
  }

  // —— SUBSCRIPTION_RESET ——
  const acctWhere = includeOverdue
    ? {
        monthlyGrantCredits: { gt: 0 },
        currentPeriodEnd: { not: null },
        OR: [
          { currentPeriodEnd: { gte: dayStart, lte: dayEnd } },
          ...(date <= today ? [{ currentPeriodEnd: { lt: now } }] : []),
        ],
      }
    : {
        monthlyGrantCredits: { gt: 0 },
        currentPeriodEnd: { gte: dayStart, lte: dayEnd },
      };

  const accounts = await prisma.creditAccount.findMany({
    where: acctWhere,
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      monthlyGrantCredits: true,
      currentPeriodEnd: true,
    },
  });

  const resetItems: WorkItemUpsert[] = [];
  for (const acct of accounts) {
    if (!acct.currentPeriodEnd) continue;
    const dueDate = cstBusinessDate(acct.currentPeriodEnd);
    const periodKey = subscriptionCreditPeriodKey(acct.currentPeriodEnd);
    resetItems.push({
      workType: "SUBSCRIPTION_RESET",
      dueDate,
      dueAt: acct.currentPeriodEnd,
      accountId: acct.id,
      ownerType: acct.ownerType,
      ownerId: acct.ownerId,
      ownerHint: null,
      source: "SUBSCRIPTION",
      periodKey,
      expectedExpireCredits: 0,
      expectedGrantCredits: acct.monthlyGrantCredits,
    });
  }

  const allRefs = [...lotGroups.values(), ...resetItems];
  const hints = await resolveOwnerHints(allRefs);
  for (const item of allRefs) {
    item.ownerHint = hints.get(`${item.ownerType}:${item.ownerId}`) ?? null;
  }

  items.push(...lotGroups.values(), ...resetItems);
  const { created, updated } = await upsertWorkItems(items);
  const promoted = await promoteOverdueWorkItems(now);
  return { created, updated, promoted };
}

async function shouldSkipSubscriptionReset(
  ownerType: "USER" | "TENANT",
  ownerId: string,
  membershipPaidUntil: Date | null | undefined,
  now: Date,
): Promise<string | null> {
  if (ownerType === "TENANT") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ownerId },
      select: { status: true, currentPeriodEnd: true },
    });
    if (!tenant || tenant.status !== "ACTIVE") return "团队非 ACTIVE";
    if (!isMembershipServiceActive(tenant.currentPeriodEnd, now)) return "团队会员服务已过期";
    return null;
  }
  if (!isMembershipServiceActive(membershipPaidUntil, now)) return "个人会员服务已过期";
  return null;
}

async function executeWorkItem(
  item: {
    id: string;
    workType: CreditOpsWorkType;
    accountId: string;
    ownerType: "USER" | "TENANT";
    ownerId: string;
    periodKey: string;
    dueDate: string;
    expectedExpireCredits: number;
  },
  now: Date,
): Promise<{ status: CreditOpsWorkStatus; resultJson: object; errorMessage?: string }> {
  const ref = { ownerType: item.ownerType, ownerId: item.ownerId };

  if (item.workType === "BATCH_EXPIRE") {
    const before = await prisma.creditLot.aggregate({
      where: {
        accountId: item.accountId,
        remainingCredits: { gt: 0 },
        expiresAt: { lte: now },
      },
      _sum: { remainingCredits: true },
    });
    const expired = await expireDueLotsForAccount(ref, now);
    const total = expired.expiredCredits;
    const after = await prisma.creditLot.aggregate({
      where: {
        accountId: item.accountId,
        remainingCredits: { gt: 0 },
        expiresAt: { lte: now },
      },
      _sum: { remainingCredits: true },
    });
    const drift = (after._sum.remainingCredits ?? 0) > 0;
    return {
      status: drift && total === 0 ? "FAILED" : "DONE",
      resultJson: {
        expiredCredits: expired.expiredCredits,
        beforeDue: before._sum.remainingCredits ?? 0,
        afterDue: after._sum.remainingCredits ?? 0,
        drift,
      },
      errorMessage: drift && total === 0 ? "到期批次仍存在剩余且未产生 EXPIRE" : undefined,
    };
  }

  const acct = await prisma.creditAccount.findUnique({
    where: { id: item.accountId },
    select: {
      monthlyGrantCredits: true,
      planId: true,
      perSeatCapCredits: true,
      currentPeriodEnd: true,
      membershipPaidUntil: true,
    },
  });
  if (!acct?.currentPeriodEnd) {
    return { status: "SKIPPED", resultJson: { reason: "无 currentPeriodEnd" } };
  }

  const skipReason = await shouldSkipSubscriptionReset(
    item.ownerType,
    item.ownerId,
    acct.membershipPaidUntil,
    now,
  );
  if (skipReason) {
    return { status: "SKIPPED", resultJson: { reason: skipReason } };
  }

  const base = acct.currentPeriodEnd <= now ? acct.currentPeriodEnd : acct.currentPeriodEnd;
  const nextEnd = subscriptionCreditPeriodEnd(base);
  const periodKey = item.periodKey || subscriptionCreditPeriodKey(base);

  const res = await resetMonthlyCredits({
    ref,
    monthlyGrantCredits: acct.monthlyGrantCredits,
    periodKey,
    planId: acct.planId,
    nextPeriodEnd: nextEnd,
    perSeatCapCredits: acct.perSeatCapCredits,
  });

  return {
    status: "DONE",
    resultJson: {
      deduped: res.deduped,
      target: res.target,
      balanceBefore: res.balanceBefore,
      nextPeriodEnd: nextEnd.toISOString(),
    },
  };
}

export type RunCreditOpsPhase = "expire" | "reset" | "all";

export async function runCreditOpsJob(input: {
  jobType: CreditOpsJobType;
  phase: RunCreditOpsPhase;
  trigger: CreditOpsJobTrigger;
  triggeredByUserId?: string | null;
  scheduledDate?: string;
  workItemIds?: string[];
  onlyOverdue?: boolean;
  dryRun?: boolean;
  now?: Date;
}): Promise<{
  dryRun: boolean;
  jobRunId: string | null;
  stats: { total: number; done: number; failed: number; skipped: number; backfilled: number };
  preview?: Array<{ id: string; workType: string; ownerHint: string | null; dueDate: string }>;
}> {
  const now = input.now ?? new Date();
  const scheduledDate = input.scheduledDate ?? cstBusinessDate(now);
  await promoteOverdueWorkItems(now);

  const workTypes: CreditOpsWorkType[] =
    input.phase === "expire"
      ? ["BATCH_EXPIRE"]
      : input.phase === "reset"
        ? ["SUBSCRIPTION_RESET"]
        : ["BATCH_EXPIRE", "SUBSCRIPTION_RESET"];

  const statusFilter: CreditOpsWorkStatus[] = input.onlyOverdue
    ? ["OVERDUE"]
    : ["PENDING", "OVERDUE"];

  const where = {
    status: { in: statusFilter },
    workType: { in: workTypes },
    ...(input.workItemIds?.length ? { id: { in: input.workItemIds } } : {}),
    ...(!input.workItemIds?.length && !input.onlyOverdue ? { dueDate: { lte: scheduledDate } } : {}),
  };

  const items = await prisma.creditOpsWorkItem.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { dueAt: "asc" }],
  });

  if (input.dryRun) {
    return {
      dryRun: true,
      jobRunId: null,
      stats: { total: items.length, done: 0, failed: 0, skipped: 0, backfilled: 0 },
      preview: items.map((i) => ({
        id: i.id,
        workType: i.workType,
        ownerHint: i.ownerHint,
        dueDate: i.dueDate,
      })),
    };
  }

  const jobRun = await prisma.creditOpsJobRun.create({
    data: {
      jobType: input.jobType,
      scheduledDate,
      trigger: input.trigger,
      triggeredByUserId: input.triggeredByUserId ?? null,
      status: "RUNNING",
    },
  });

  const stats = { total: items.length, done: 0, failed: 0, skipped: 0, backfilled: 0 };
  const today = cstBusinessDate(now);
  const errors: string[] = [];

  // BATCH_EXPIRE：同账户只执行一次 expireDueLotsForAccount
  const expireAccountsDone = new Set<string>();

  for (const item of items) {
    await prisma.creditOpsWorkItem.update({
      where: { id: item.id },
      data: { status: "RUNNING", jobRunId: jobRun.id },
    });

    try {
      if (item.workType === "BATCH_EXPIRE") {
        const acctKey = item.accountId;
        if (expireAccountsDone.has(acctKey)) {
          await prisma.creditOpsWorkItem.update({
            where: { id: item.id },
            data: {
              status: "DONE",
              processedAt: now,
              isBackfill: item.dueDate < today,
              resultJson: { merged: true },
            },
          });
          stats.done += 1;
          if (item.dueDate < today) stats.backfilled += 1;
          continue;
        }
        expireAccountsDone.add(acctKey);
      }

      const result = await executeWorkItem(item, now);
      if (result.status === "DONE") stats.done += 1;
      else if (result.status === "SKIPPED") stats.skipped += 1;
      else stats.failed += 1;

      if (item.dueDate < today && result.status === "DONE") stats.backfilled += 1;
      if (result.errorMessage) errors.push(`${item.ownerHint ?? item.accountId}: ${result.errorMessage}`);

      await prisma.creditOpsWorkItem.update({
        where: { id: item.id },
        data: {
          status: result.status,
          processedAt: now,
          isBackfill: item.dueDate < today && result.status === "DONE",
          resultJson: result.resultJson,
          errorMessage: result.errorMessage ?? null,
        },
      });
    } catch (e) {
      stats.failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${item.ownerHint ?? item.accountId}: ${msg}`);
      await prisma.creditOpsWorkItem.update({
        where: { id: item.id },
        data: { status: "FAILED", processedAt: now, errorMessage: msg },
      });
    }
  }

  const finalStatus =
    stats.failed > 0 ? (stats.done + stats.skipped > 0 ? "PARTIAL" : "FAILED") : "SUCCESS";

  await prisma.creditOpsJobRun.update({
    where: { id: jobRun.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      statsJson: stats,
      errorSummary: errors.length > 0 ? errors.slice(0, 20).join("; ") : null,
    },
  });

  return { dryRun: false, jobRunId: jobRun.id, stats };
}

export async function getCreditOpsDashboard(input?: {
  date?: string;
  now?: Date;
}): Promise<CreditOpsDashboardSnapshot> {
  const now = input?.now ?? new Date();
  const date = input?.date ?? cstBusinessDate(now);

  if (!isCreditOpsPrismaReady()) {
    return emptyCreditOpsDashboard(date);
  }

  const dayStart = cstDayStartUtc(date);
  const processedTodayWhere = {
    status: "DONE" as const,
    processedAt: { gte: dayStart },
  };

  const [
    pending,
    overdue,
    processedToday,
    backfilledToday,
    totalDone,
    skippedToday,
    failedToday,
    staleSubscriptionLotAccounts,
    driftCount,
    lastJobs,
    todayExpireJob,
    todayResetJob,
  ] = await Promise.all([
    prisma.creditOpsWorkItem.count({ where: { dueDate: date, status: "PENDING" } }),
    prisma.creditOpsWorkItem.count({ where: { status: "OVERDUE" } }),
    prisma.creditOpsWorkItem.count({ where: processedTodayWhere }),
    prisma.creditOpsWorkItem.count({
      where: { ...processedTodayWhere, isBackfill: true },
    }),
    prisma.creditOpsWorkItem.count({ where: { status: "DONE" } }),
    prisma.creditOpsWorkItem.count({ where: { dueDate: date, status: "SKIPPED" } }),
    prisma.creditOpsWorkItem.count({ where: { dueDate: date, status: "FAILED" } }),
    countStaleSubscriptionLots(now),
    countDriftWorkItems(),
    prisma.creditOpsJobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        jobType: true,
        scheduledDate: true,
        trigger: true,
        status: true,
        statsJson: true,
        startedAt: true,
        finishedAt: true,
        errorSummary: true,
      },
    }),
    prisma.creditOpsJobRun.findFirst({
      where: { jobType: "DAILY_EXPIRE_SWEEP", scheduledDate: date },
      orderBy: { startedAt: "desc" },
      select: {
        jobType: true,
        scheduledDate: true,
        status: true,
        startedAt: true,
        statsJson: true,
        trigger: true,
      },
    }),
    prisma.creditOpsJobRun.findFirst({
      where: { jobType: "DAILY_SUBSCRIPTION_RESET", scheduledDate: date },
      orderBy: { startedAt: "desc" },
      select: {
        jobType: true,
        scheduledDate: true,
        status: true,
        startedAt: true,
        statsJson: true,
        trigger: true,
      },
    }),
  ]);

  const alerts = evaluateCreditOpsAlerts({
    now,
    todayCst: date,
    overdueCount: overdue,
    staleSubscriptionLotAccounts,
    driftCount,
    latestExpireJob: toJobSummary(todayExpireJob),
    latestResetJob: toJobSummary(todayResetJob),
  });

  return {
    date,
    prismaReady: true,
    opsHealth: computeOpsHealth({
      prismaReady: true,
      overdue,
      failedToday,
      staleSubscriptionLotAccounts,
      driftCount,
      alerts,
    }),
    pending,
    overdue,
    doneToday: processedToday,
    processedToday,
    backfilledToday,
    totalDone,
    skippedToday,
    failedToday,
    staleSubscriptionLotAccounts,
    driftCount,
    cronRanToday: {
      expire: todayExpireJob?.trigger === "CRON",
      reset: todayResetJob?.trigger === "CRON",
    },
    lastJobs,
  };
}

export async function listCreditOpsWorkItems(input: {
  date?: string;
  status?: CreditOpsWorkStatus;
  workType?: CreditOpsWorkType;
  q?: string;
  take?: number;
  skip?: number;
}) {
  const take = Math.min(200, input.take ?? 50);
  const skip = input.skip ?? 0;
  const where = {
    ...(input.date ? { dueDate: input.date } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.workType ? { workType: input.workType } : {}),
    ...(input.q
      ? {
          OR: [
            { ownerHint: { contains: input.q, mode: "insensitive" as const } },
            { ownerId: { contains: input.q } },
            { accountId: { contains: input.q } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.creditOpsWorkItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take,
      skip,
    }),
    prisma.creditOpsWorkItem.count({ where }),
  ]);

  return { items, total, take, skip };
}

export async function listCreditOpsJobRuns(take = 20) {
  return prisma.creditOpsJobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: Math.min(100, take),
    include: { workItems: { select: { id: true, status: true, workType: true } } },
  });
}

async function countStaleSubscriptionLots(now: Date): Promise<number> {
  const rows = await prisma.creditLot.findMany({
    where: {
      source: "SUBSCRIPTION",
      remainingCredits: { gt: 0 },
      expiresAt: { lte: now },
    },
    distinct: ["accountId"],
    select: { accountId: true },
  });
  return rows.length;
}

async function countDriftWorkItems(): Promise<number> {
  const done = await prisma.creditOpsWorkItem.findMany({
    where: { status: "DONE", workType: "BATCH_EXPIRE" },
    select: { resultJson: true },
    take: 500,
    orderBy: { processedAt: "desc" },
  });
  return done.filter((d) => {
    const r = d.resultJson as { drift?: boolean } | null;
    return r?.drift === true;
  }).length;
}

function toJobSummary(
  job: {
    jobType: string;
    scheduledDate: string;
    status: CreditOpsJobRunSummary["status"];
    startedAt: Date;
    statsJson: unknown;
  } | null,
): CreditOpsJobRunSummary | null {
  if (!job) return null;
  return {
    jobType: job.jobType,
    scheduledDate: job.scheduledDate,
    status: job.status,
    startedAt: job.startedAt,
    statsJson: job.statsJson,
  };
}

export async function getCreditOpsAlerts(now: Date = new Date()): Promise<CreditOpsAlert[]> {
  const todayCst = cstBusinessDate(now);

  if (!isCreditOpsPrismaReady()) {
    return [
      {
        code: "CRON_NOT_RUN",
        level: "WARN",
        message:
          "积分运维模块未加载：请在本机执行 pnpm db:apply-pending && pnpm db:generate，并重启 pnpm dev:all。",
      },
    ];
  }

  const [overdueCount, staleSubscriptionLotAccounts, driftCount, expireJob, resetJob] =
    await Promise.all([
      prisma.creditOpsWorkItem.count({ where: { status: "OVERDUE" } }),
      countStaleSubscriptionLots(now),
      countDriftWorkItems(),
      prisma.creditOpsJobRun.findFirst({
        where: { jobType: "DAILY_EXPIRE_SWEEP", scheduledDate: todayCst },
        orderBy: { startedAt: "desc" },
        select: { jobType: true, scheduledDate: true, status: true, startedAt: true, statsJson: true },
      }),
      prisma.creditOpsJobRun.findFirst({
        where: { jobType: "DAILY_SUBSCRIPTION_RESET", scheduledDate: todayCst },
        orderBy: { startedAt: "desc" },
        select: { jobType: true, scheduledDate: true, status: true, startedAt: true, statsJson: true },
      }),
    ]);

  return evaluateCreditOpsAlerts({
    now,
    todayCst,
    overdueCount,
    staleSubscriptionLotAccounts,
    driftCount,
    latestExpireJob: toJobSummary(expireJob),
    latestResetJob: toJobSummary(resetJob),
  });
}

/** Cron 包装：批次到期清扫 + 工单回写。 */
export async function runDailyExpireSweepOps(input?: {
  trigger?: CreditOpsJobTrigger;
  triggeredByUserId?: string | null;
  dryRun?: boolean;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  await generateCreditOpsWorkItems({ includeOverdue: true, now });
  return runCreditOpsJob({
    jobType: "DAILY_EXPIRE_SWEEP",
    phase: "expire",
    trigger: input?.trigger ?? "CRON",
    triggeredByUserId: input?.triggeredByUserId,
    dryRun: input?.dryRun,
    now,
  });
}

/** Cron 包装：订阅积分刷新 + 工单回写。 */
export async function runDailySubscriptionResetOps(input?: {
  trigger?: CreditOpsJobTrigger;
  triggeredByUserId?: string | null;
  dryRun?: boolean;
  onlyOverdue?: boolean;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  await generateCreditOpsWorkItems({ includeOverdue: true, now });
  return runCreditOpsJob({
    jobType: "DAILY_SUBSCRIPTION_RESET",
    phase: "reset",
    trigger: input?.trigger ?? "CRON",
    triggeredByUserId: input?.triggeredByUserId,
    dryRun: input?.dryRun,
    onlyOverdue: input?.onlyOverdue,
    now,
  });
}
