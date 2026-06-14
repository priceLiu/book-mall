import { getActiveByokSubscription } from "@/lib/billing/byok-subscription-service";
import {
  getAccountByokTaskSummary,
  getAccountPackageUsageRows,
  getAccountPlatformCategoryUsageRows,
  getAccountUsageSummary,
  type PackageUsageRow,
} from "@/lib/finance/account-usage-summary";
import { prisma } from "@/lib/prisma";

export type UserPackageReconciliation = {
  periodKey: string;
  billingPersona: string | null;
  scopeKey: string | null;
  usageSummary: Awaited<ReturnType<typeof getAccountUsageSummary>>;
  packageUsageRows: PackageUsageRow[];
  byokTaskSummary: Awaited<ReturnType<typeof getAccountByokTaskSummary>>;
};

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 单用户套餐 + 积分对帐摘要（财务明细/概览共用）。 */
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
  const [usageSummary, packageUsageRows, byokTaskSummary] = await Promise.all([
    getAccountUsageSummary(bookUserId),
    packageRowsPromise,
    scopeKey ? getAccountByokTaskSummary(bookUserId, scopeKey) : Promise.resolve([]),
  ]);

  return {
    periodKey: currentPeriodKey(),
    billingPersona: user.billingPersona,
    scopeKey,
    usageSummary,
    packageUsageRows,
    byokTaskSummary,
  };
}
