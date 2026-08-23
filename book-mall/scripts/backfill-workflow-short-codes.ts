/**
 * 为存量 WorkflowShareLink 回填 shortCode（10 位）。
 * 用法：cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/backfill-workflow-short-codes.ts
 */
import { prisma } from "@/lib/prisma";
import { generateWorkflowShareShortCode } from "@/lib/share/share-code-service";

async function main() {
  const rows = await prisma.workflowShareLink.findMany({
    where: { shortCode: null },
    select: { id: true, app: true },
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;
  for (const row of rows) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const shortCode = await generateWorkflowShareShortCode(row.app);
      try {
        await prisma.workflowShareLink.update({
          where: { id: row.id },
          data: { shortCode },
        });
        updated += 1;
        console.log(`[backfill] ${row.id} → ${shortCode}`);
        break;
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") continue;
        throw e;
      }
    }
  }

  console.log(`[backfill] 完成：${updated}/${rows.length} 条已写入 shortCode`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
