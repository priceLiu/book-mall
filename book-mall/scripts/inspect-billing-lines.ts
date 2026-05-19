/**
 * 一次性：列出所有 ToolBillingDetailLine，确认数据归属
 * ./node_modules/.bin/dotenv -e .env.local -- ./node_modules/.bin/tsx scripts/inspect-billing-lines.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const lines = await prisma.toolBillingDetailLine.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const compact = lines.map((l) => {
    const cr = (l.cloudRow as Record<string, unknown> | null) ?? {};
    return {
      id: l.id,
      source: l.source,
      userId: l.userId,
      toolUsageEventId: l.toolUsageEventId,
      createdAt: l.createdAt.toISOString(),
      product: cr["平台/产品名称"] ?? null,
      billable: cr["平台/计费项Code"] ?? null,
      qty: cr["平台用量/用量"] ?? null,
      unit: cr["平台用量/用量单位"] ?? null,
      formula: cr["平台/计费公式"] ?? null,
      payable: cr["平台/应付金额"] ?? null,
      vendorListed: cr["厂商定价/官网目录价"] ?? null,
      vendorUnit: cr["厂商定价/价格单位"] ?? null,
      vendorProductName: cr["厂商产品/产品名称"] ?? null,
      vendorCommodityName: cr["厂商产品/商品名称"] ?? null,
    };
  });

  console.log(`count=${lines.length}`);
  console.log(JSON.stringify(compact, null, 2));

  const userIds = Array.from(new Set(lines.map((l) => l.userId).filter(Boolean))) as string[];
  if (userIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    console.log("\nusers:");
    console.log(JSON.stringify(users, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
