/**
 * 清空 legacy ToolBillingDetailLine（Finance 2.0 账单仅走 GatewayRequestLog）。
 *
 *   pnpm tsx scripts/clear-legacy-billing-lines.ts --confirm
 */
import { prisma } from "../lib/prisma";

async function main() {
  const confirm = process.argv.includes("--confirm");
  const count = await prisma.toolBillingDetailLine.count();
  if (!confirm) {
    console.log(`将删除 ToolBillingDetailLine ${count} 行。请加 --confirm 执行。`);
    return;
  }
  const r = await prisma.toolBillingDetailLine.deleteMany({});
  console.log(`已删除 legacy 账单明细 ${r.count} 行。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
