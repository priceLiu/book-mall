import {
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
  byokTaskSummary: [];
};

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 单用户套餐 + 积分对帐摘要（财务明细/概览共用）。 */
export async function fetchUserPackageReconciliation(
  bookUserId: string,
): Promise<UserPackageReconciliation | null> {
  const user = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { billingPersona: true },
  });
  if (!user) return null;

  const [usageSummary, packageUsageRows] = await Promise.all([
    getAccountUsageSummary(bookUserId),
    getAccountPlatformCategoryUsageRows(bookUserId),
  ]);

  return {
    periodKey: currentPeriodKey(),
    billingPersona: user.billingPersona,
    scopeKey: null,
    usageSummary,
    packageUsageRows,
    byokTaskSummary: [],
  };
}
