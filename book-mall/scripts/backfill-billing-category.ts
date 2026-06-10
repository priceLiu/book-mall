/**
 * 回填 BillingSettlementLine / GatewayRequestLog.billingCategory（只重算类别，不改扣费）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-billing-category.ts
 */
import { classifyBillingCategory } from "../lib/billing/billing-category";
import { prisma } from "../lib/prisma";

const BATCH = 500;

async function backfillSettlements(): Promise<number> {
  let updated = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.billingSettlementLine.findMany({
      where: { billingCategory: null },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        gatewayLogId: true,
        requestKind: true,
      },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const log = await prisma.gatewayRequestLog.findUnique({
        where: { id: row.gatewayLogId },
        select: { requestKind: true, inputSummary: true },
      });
      if (!log) continue;
      const billingCategory = classifyBillingCategory(log);
      await prisma.billingSettlementLine.update({
        where: { id: row.id },
        data: { billingCategory },
      });
      await prisma.gatewayRequestLog.update({
        where: { id: row.gatewayLogId },
        data: { billingCategory },
      });
      updated += 1;
    }

    cursor = rows[rows.length - 1]?.id;
    if (rows.length < BATCH) break;
  }

  return updated;
}

async function backfillLogsWithoutSettlement(): Promise<number> {
  let updated = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.gatewayRequestLog.findMany({
      where: { billingCategory: null },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, requestKind: true, inputSummary: true },
    });
    if (rows.length === 0) break;

    for (const log of rows) {
      await prisma.gatewayRequestLog.update({
        where: { id: log.id },
        data: { billingCategory: classifyBillingCategory(log) },
      });
      updated += 1;
    }

    cursor = rows[rows.length - 1]?.id;
    if (rows.length < BATCH) break;
  }

  return updated;
}

async function main() {
  const settlements = await backfillSettlements();
  const logs = await backfillLogsWithoutSettlement();
  console.log(`[ok] settlements=${settlements}, logs=${logs}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
