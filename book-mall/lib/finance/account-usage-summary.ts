import { prisma } from "@/lib/prisma";
import {
  BILLING_CATEGORY_LABEL,
  BILLING_CATEGORY_ORDER,
  classifyBillingCategory,
  type BillingCategoryKey,
} from "@/lib/billing/billing-category";
import type { AccountRef } from "@/lib/billing/credit-account-service";
import { getAccountCreditBalances } from "@/lib/billing/credit-account-service";
import {
  buildGatewayLogActorWhere,
  buildGatewayLogWhereForTeamTenant,
} from "@/lib/gateway/log-query-scope";
import {
  clientPageToToolKey,
  clientPageToToolLabel,
} from "@/lib/finance/client-page-tool";

function monthStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type PackageUsageRow = {
  key: string;
  label: string;
  /** 套餐内总额度；文字类无额度时为 null */
  total: number | null;
  /** BYOK 套餐内已扣次数（与「剩余」同一口径：剩余 = 总数 − 已用） */
  includedUsed: number | null;
  succeeded: number;
  failed: number;
  remaining: number | null;
  /** 平台代付：本月扣积分（BYOK 行通常为 null） */
  creditsConsumed?: number | null;
};

/** 平台代付：本月按七类消耗（次数 + 积分，无含次额度）。 */
export async function getAccountPlatformCategoryUsageRows(
  bookUserId: string,
  billingOwner?: AccountRef,
): Promise<PackageUsageRow[]> {
  const since = monthStartUtc();
  const periodKey = currentPeriodKey();
  const isTeamPool =
    billingOwner?.ownerType === "TENANT" && billingOwner.ownerId;

  const [logs, settlements] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where: isTeamPool
        ? await buildGatewayLogWhereForTeamTenant(billingOwner!.ownerId, {
            submittedFrom: since,
            statuses: ["SUCCEEDED", "FAILED"],
          })
        : buildGatewayLogActorWhere(bookUserId, {
            submittedFrom: since,
            statuses: ["SUCCEEDED", "FAILED"],
          }),
      select: { requestKind: true, status: true, inputSummary: true },
    }),
    prisma.billingSettlementLine.findMany({
      where: isTeamPool
        ? {
            ownerType: "TENANT",
            ownerId: billingOwner!.ownerId,
            periodKey,
          }
        : { actorBookUserId: bookUserId, periodKey },
      select: { billingCategory: true, creditsCharged: true },
    }),
  ]);

  const counts = new Map<BillingCategoryKey, { succeeded: number; failed: number }>();
  const creditsByCat = new Map<BillingCategoryKey, number>();

  for (const log of logs) {
    const cat = classifyBillingCategory(log);
    const row = counts.get(cat) ?? { succeeded: 0, failed: 0 };
    if (log.status === "SUCCEEDED") row.succeeded += 1;
    else row.failed += 1;
    counts.set(cat, row);
  }

  for (const s of settlements) {
    if (!s.billingCategory) continue;
    creditsByCat.set(
      s.billingCategory,
      (creditsByCat.get(s.billingCategory) ?? 0) + (s.creditsCharged ?? 0),
    );
  }

  return BILLING_CATEGORY_ORDER.map((cat) => {
    const c = counts.get(cat) ?? { succeeded: 0, failed: 0 };
    return {
      key: cat,
      label: BILLING_CATEGORY_LABEL[cat],
      total: null,
      includedUsed: null,
      succeeded: c.succeeded,
      failed: c.failed,
      remaining: null,
      creditsConsumed: creditsByCat.get(cat) ?? 0,
    };
  });
}

/** 个人中心概览：本月积分（区分轻量包加购 vs 套餐月发）+ 调用统计。 */
export async function getAccountUsageSummary(
  bookUserId: string,
  billingOwner?: AccountRef,
) {
  const ref = billingOwner ?? { ownerType: "USER" as const, ownerId: bookUserId };
  const isTeamPool = ref.ownerType === "TENANT";
  const since = monthStartUtc();

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: ref },
    select: { id: true, planId: true, balanceCredits: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { billingPersona: true },
  });

  const [balances, topupAgg, grantAgg, adjustAgg, consumedAgg, totalCalls] = await Promise.all([
    getAccountCreditBalances(ref),
    account
      ? prisma.creditLedger.aggregate({
          where: { accountId: account.id, createdAt: { gte: since }, type: "TOPUP" },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    account
      ? prisma.creditLedger.aggregate({
          where: { accountId: account.id, createdAt: { gte: since }, type: "GRANT" },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    account
      ? prisma.creditLedger.aggregate({
          where: { accountId: account.id, createdAt: { gte: since }, type: "ADJUST" },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    account
      ? prisma.creditLedger.aggregate({
          where: {
            accountId: account.id,
            createdAt: { gte: since },
            type: { in: ["CONSUME", "SETTLE"] },
          },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    isTeamPool
      ? prisma.gatewayRequestLog.count({
          where: await buildGatewayLogWhereForTeamTenant(ref.ownerId, {
            status: "SUCCEEDED",
            submittedFrom: since,
          }),
        })
      : prisma.gatewayRequestLog.count({
          where: buildGatewayLogActorWhere(bookUserId, {
            status: "SUCCEEDED",
            submittedFrom: since,
          }),
        }),
  ]);

  const topupRaw = Math.max(0, topupAgg._sum.credits ?? 0);
  let grantCreditsThisMonth = Math.max(0, grantAgg._sum.credits ?? 0);
  const adjustCreditsThisMonth = Math.max(0, adjustAgg._sum.credits ?? 0);
  const creditsConsumed = Math.abs(consumedAgg._sum.credits ?? 0);
  const creditsRemaining = balances.balance;

  const topupCreditsThisMonth = Math.min(
    topupRaw,
    Math.max(0, creditsRemaining + creditsConsumed),
  );

  const creditsGranted =
    topupCreditsThisMonth + grantCreditsThisMonth + adjustCreditsThisMonth;

  return {
    periodStart: since.toISOString(),
    creditsGranted,
    topupCreditsThisMonth,
    grantCreditsThisMonth,
    adjustCreditsThisMonth,
    creditsConsumed,
    creditsRemaining,
    balance: balances.balance,
    reserved: balances.reserved,
    totalCallsThisMonth: totalCalls,
  };
}

/** 套餐内任务使用情况（本月 Gateway 成功/失败 + 七类消耗）。 */
export async function getAccountPackageUsageRows(
  bookUserId: string,
  _scopeKey: string | null = null,
): Promise<PackageUsageRow[]> {
  return getAccountPlatformCategoryUsageRows(bookUserId);
}

/** 历史 BYOK 含次摘要（已退役，恒空）。 */
export async function getAccountByokTaskSummary(
  _bookUserId: string,
  _scopeKey: string,
): Promise<[]> {
  return [];
}

/** 按工具聚合 Gateway 成功调用。 */
export async function aggregateUsageByTool(bookUserId: string) {
  const logs = await prisma.gatewayRequestLog.findMany({
    where: buildGatewayLogActorWhere(bookUserId, { status: "SUCCEEDED" }),
    select: { clientPage: true, creditsCharged: true },
  });

  const map = new Map<string, { count: number; creditsCharged: number; toolLabel: string }>();
  for (const log of logs) {
    const toolKey = log.clientPage?.trim()
      ? log.clientPage.trim().replace(/\//g, "__")
      : clientPageToToolKey(log.clientPage);
    const ex = map.get(toolKey) ?? {
      count: 0,
      creditsCharged: 0,
      toolLabel: clientPageToToolLabel(log.clientPage),
    };
    ex.count += 1;
    ex.creditsCharged += log.creditsCharged ?? 0;
    map.set(toolKey, ex);
  }

  return Array.from(map.entries())
    .map(([toolKey, v]) => ({ toolKey, ...v }))
    .sort((a, b) => b.count - a.count || b.creditsCharged - a.creditsCharged);
}

export async function countSucceededUsage(bookUserId: string): Promise<number> {
  return prisma.gatewayRequestLog.count({
    where: buildGatewayLogActorWhere(bookUserId, { status: "SUCCEEDED" }),
  });
}
