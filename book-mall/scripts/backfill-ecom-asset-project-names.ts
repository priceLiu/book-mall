/**
 * 旧电商资产 meta 回填 projectId / projectName，便于「我的资产」按项目分组。
 *
 * 解析顺序：meta.projectId → 产品设计 slot.assetId → 分镜 sheet 媒体 URL / videoAssetId。
 * 打开资产库时会按用户懒回填；本脚本用于全量一次性处理。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/backfill-ecom-asset-project-names.ts [--confirm]
 */
import { backfillEcomAssetProjectNamesForAllUsers } from "../lib/ecom/ecom-library-asset-project-backfill";
import { prisma } from "../lib/prisma";

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  if (!CONFIRM) {
    console.log("DRY-RUN: 加 --confirm 实际写入 meta.projectName / meta.projectId");
    console.log("（打开「我的资产」也会按用户懒回填，无需强制跑本脚本）");
    return;
  }

  const result = await backfillEcomAssetProjectNamesForAllUsers();
  console.log("[backfill-ecom-asset-project-names] done:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
