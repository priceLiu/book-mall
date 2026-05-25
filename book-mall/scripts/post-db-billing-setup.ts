/**
 * 迁移/重建库后：价目表 + 模型目录 + 厂商字段 + 账单快照 一站式修复（幂等）。
 *
 * 用法：cd book-mall && pnpm db:post-billing-setup
 */
import { prisma } from "../lib/prisma";
import { runPostDbBillingSetup } from "../lib/post-db-billing-setup";

async function main() {
  const result = await runPostDbBillingSetup();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
