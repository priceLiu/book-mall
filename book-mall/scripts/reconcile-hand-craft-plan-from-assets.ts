/**
 * 诊断并从 EcomAsset 回填手办项目 plan 槽位（本地运维 · 读 DATABASE_URL）
 *
 * 用法：
 *   pnpm --dir book-mall exec tsx scripts/reconcile-hand-craft-plan-from-assets.ts
 *   pnpm --dir book-mall exec tsx scripts/reconcile-hand-craft-plan-from-assets.ts <projectId>
 */
import { PrismaClient } from "@prisma/client";

import {
  readHandCraftStepState,
  syncEcomHandCraftProjectPlanFromAssets,
} from "../lib/ecom/ecom-hand-craft-service";
import { parseHandCraftPlan } from "../lib/ecom/ecom-hand-craft-types";
import { loadIpWorkflowProjectAssets } from "../lib/ecom/ecom-ip-workflow-asset-reconcile";

const prisma = new PrismaClient();

async function diagnoseProject(userId: string, projectId: string) {
  const row = await prisma.ecomHandCraftProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  const plan = parseHandCraftPlan(row.plan);
  const emoji = readHandCraftStepState(plan, "emoji");
  const emptyEmoji = emoji.slots.filter((s) => !s.imageUrl?.trim()).map((s) => s.index);
  const assets = await loadIpWorkflowProjectAssets({
    userId,
    module: "hand-craft",
    projectId,
    source: "hand-craft",
  });
  const emojiAssets = [...assets.keys()].filter((k) => k.startsWith("emoji::"));
  return { title: row.title, emptyEmoji, emojiAssets, assetCount: assets.size };
}

async function main() {
  const projectIdArg = process.argv[2]?.trim();

  if (projectIdArg) {
    const row = await prisma.ecomHandCraftProject.findFirst({
      where: { id: projectIdArg },
      select: { id: true, userId: true, title: true },
    });
    if (!row) {
      console.error("项目不存在:", projectIdArg);
      process.exit(1);
    }
    const before = await diagnoseProject(row.userId, row.id);
    console.log("诊断", row.id, row.title, before);
    const { project, recoveredImages } = await syncEcomHandCraftProjectPlanFromAssets(
      row.userId,
      row.id,
    );
    const after = project
      ? readHandCraftStepState(project.plan, "emoji").slots.filter(
          (s) => !s.imageUrl?.trim(),
        ).map((s) => s.index)
      : [];
    console.log("回填 recoveredImages=", recoveredImages, "emoji 仍空:", after);
    return;
  }

  const rows = await prisma.ecomHandCraftProject.findMany({
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: { id: true, userId: true, title: true, updatedAt: true },
  });

  let totalRecovered = 0;
  for (const row of rows) {
    const d = await diagnoseProject(row.userId, row.id);
    if (!d || d.emptyEmoji.length === 0) continue;
    console.log("\n---", row.id, row.title, "updated", row.updatedAt.toISOString());
    console.log("  emoji 空槽:", d.emptyEmoji.join(","), "| 资产键:", d.emojiAssets.join(", "));
    const { recoveredImages } = await syncEcomHandCraftProjectPlanFromAssets(
      row.userId,
      row.id,
    );
    if (recoveredImages > 0) {
      console.log("  → 回填", recoveredImages, "张");
      totalRecovered += recoveredImages;
    } else if (d.emojiAssets.length > 0) {
      console.log("  → 有资产但未写入，请检查 reconcile / meta");
    } else {
      console.log("  → 资产库无 emoji 记录（Gateway 成功但未落 EcomAsset？）");
    }
  }
  console.log("\n合计回填", totalRecovered, "张");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
