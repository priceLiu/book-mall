import { getActiveByokSubscription } from "@/lib/billing/byok-subscription-service";
import { extractTryonModelKey } from "@/lib/billing/byok-pricing";
import {
  getAccountByokTaskSummary,
  getAccountPackageUsageRows,
  getAccountPlatformCategoryUsageRows,
  getAccountUsageSummary,
  type PackageUsageRow,
} from "@/lib/finance/account-usage-summary";
import { prisma } from "@/lib/prisma";

export type TryonModelUsageRow = {
  modelKey: string;
  label: string;
  succeeded: number;
  failed: number;
};

export type UserPackageReconciliation = {
  periodKey: string;
  billingPersona: string | null;
  scopeKey: string | null;
  usageSummary: Awaited<ReturnType<typeof getAccountUsageSummary>>;
  packageUsageRows: PackageUsageRow[];
  byokTaskSummary: Awaited<ReturnType<typeof getAccountByokTaskSummary>>;
  tryonByModel: TryonModelUsageRow[];
};

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** 试衣按模型统计成功/失败（套餐额度归文生图桶，明细按 modelKey 拆分）。 */
export async function getTryonUsageByModel(bookUserId: string): Promise<TryonModelUsageRow[]> {
  const since = monthStartUtc();
  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      actorBookUserId: bookUserId,
      requestKind: "TRYON",
      submittedAt: { gte: since },
      status: { in: ["SUCCEEDED", "FAILED"] },
    },
    select: {
      status: true,
      model: true,
      canonicalModelKey: true,
      inputSummary: true,
    },
  });

  const counts = new Map<string, { succeeded: number; failed: number }>();
  for (const log of logs) {
    const mk = extractTryonModelKey(log);
    const row = counts.get(mk) ?? { succeeded: 0, failed: 0 };
    if (log.status === "SUCCEEDED") row.succeeded += 1;
    else row.failed += 1;
    counts.set(mk, row);
  }

  return Array.from(counts.entries())
    .map(([modelKey, c]) => ({
      modelKey,
      label: modelKey,
      succeeded: c.succeeded,
      failed: c.failed,
    }))
    .sort(
      (a, b) =>
        b.succeeded + b.failed - (a.succeeded + a.failed) || a.modelKey.localeCompare(b.modelKey),
    );
}

/** 单用户套餐 + 积分 + 试衣模型对帐摘要（财务明细/概览共用）。 */
export async function fetchUserPackageReconciliation(
  bookUserId: string,
): Promise<UserPackageReconciliation | null> {
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: bookUserId },
      select: { billingPersona: true },
    }),
    getActiveByokSubscription({ ownerType: "USER", ownerId: bookUserId }),
  ]);
  if (!user) return null;

  const scopeKey = sub?.scopeKey ?? null;
  const packageRowsPromise: Promise<PackageUsageRow[]> =
    user.billingPersona === "PLATFORM_CREDIT"
      ? getAccountPlatformCategoryUsageRows(bookUserId)
      : getAccountPackageUsageRows(bookUserId, scopeKey);
  const [usageSummary, packageUsageRows, byokTaskSummary, tryonByModel] = await Promise.all([
    getAccountUsageSummary(bookUserId),
    packageRowsPromise,
    scopeKey ? getAccountByokTaskSummary(bookUserId, scopeKey) : Promise.resolve([]),
    getTryonUsageByModel(bookUserId),
  ]);

  return {
    periodKey: currentPeriodKey(),
    billingPersona: user.billingPersona,
    scopeKey,
    usageSummary,
    packageUsageRows,
    byokTaskSummary,
    tryonByModel,
  };
}
