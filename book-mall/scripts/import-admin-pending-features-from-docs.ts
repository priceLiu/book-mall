/**
 * 从 docs/ 批量导入待做功能（与后台「从 docs 导入」相同逻辑）。
 * 用法：cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/import-admin-pending-features-from-docs.ts
 */
import { importAdminPendingFeaturesFromDocs } from "@/lib/admin/pending-feature-service";
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await importAdminPendingFeaturesFromDocs();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
