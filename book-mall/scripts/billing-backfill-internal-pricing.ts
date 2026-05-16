/**
 * 为已存在、但未写入 internal* 快照的 ToolBillingDetailLine 按当前 cloudRow 回填对内计价列。
 * 快照时间取该行 createdAt（表示与行创建同一时点口径）。
 *
 * dotenv -e .env.local -- tsx scripts/billing-backfill-internal-pricing.ts
 *
 * 可选：BILLING_BACKFILL_USER_ID=xxx 仅回填指定用户
 */
import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  computeInternalPricingWithTemplate,
  prismaDataFromInternalSnapshot,
} from "../lib/finance/cloud-bill-enrich";

async function main() {
  const onlyUser = process.env.BILLING_BACKFILL_USER_ID?.trim();

  const where: Prisma.ToolBillingDetailLineWhereInput = {
    internalChargedPoints: null,
    ...(onlyUser ? { userId: onlyUser } : {}),
  };

  const lines = await prisma.toolBillingDetailLine.findMany({
    where,
    select: { id: true, cloudRow: true, createdAt: true, pricingTemplateKey: true },
  });

  let updated = 0;
  for (const line of lines) {
    const snap = computeInternalPricingWithTemplate(line.cloudRow, line.pricingTemplateKey);
    const data = prismaDataFromInternalSnapshot(snap, line.createdAt);
    await prisma.toolBillingDetailLine.update({
      where: { id: line.id },
      data,
    });
    updated += 1;
  }

  console.log(JSON.stringify({ where: onlyUser ?? "all", scanned: lines.length, updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
