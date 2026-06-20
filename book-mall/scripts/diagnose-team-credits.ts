/**
 * 排查团队套餐总积分 vs 剩余积分
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/diagnose-team-credits.ts
 */
import { buildTeamCreditBill } from "@/lib/billing/credit-reconciliation";
import { currentPeriodKey } from "@/lib/finance/team-finance-guard";
import { resolveTenantPackageSnapshot } from "@/lib/finance/tenant-package-snapshot";
import { prisma } from "@/lib/prisma";

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { type: "TEAM", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      planId: true,
      seatLimit: true,
      interval: true,
      createdAt: true,
      currentPeriodEnd: true,
    },
  });

  const periodKey = currentPeriodKey();
  for (const tenant of tenants) {
    const account = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: tenant.id } },
    });
    const pkg = await resolveTenantPackageSnapshot(tenant);
    const bill = await buildTeamCreditBill({ tenantId: tenant.id, periodKey });
    const renewalCount = account
      ? await prisma.creditLedger.count({
          where: {
            accountId: account.id,
            refType: "monthly_grant",
            type: { in: ["GRANT", "EXPIRE"] },
            idempotencyKey: { startsWith: "monthly_grant:" },
          },
        })
      : 0;
    console.log({
      name: tenant.name,
      periodKey,
      balanceCredits: account?.balanceCredits,
      monthlyGrantCredits: account?.monthlyGrantCredits,
      packageTotalCredits: pkg.packageTotalCredits,
      remainingCredits: pkg.remainingCredits,
      monthConsumed: bill.consumed,
      expectedRemaining: (pkg.packageTotalCredits ?? 0) - bill.consumed,
      currentPeriodEnd: tenant.currentPeriodEnd ?? account?.currentPeriodEnd,
      renewalLedgerRows: renewalCount,
    });

    if (account && tenant.name === "团队 2026-06-18") {
      const from = new Date("2026-06-01T00:00:00.000Z");
      const to = new Date("2026-07-01T00:00:00.000Z");
      const byType = await prisma.creditLedger.groupBy({
        by: ["type"],
        where: { accountId: account.id, createdAt: { gte: from, lt: to } },
        _sum: { credits: true },
        _count: true,
      });
      console.log("  ledger by type:", byType, {
        videoBalance: account.videoBalanceCredits,
        videoGrant: account.videoMonthlyGrant,
        videoReserved: account.videoReservedCredits,
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
