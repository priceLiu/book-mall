/**
 * 全局资产库 · 为已有 catalog 条目补生成 OSS 缩略图（480px WebP）。
 *
 * 用法：
 *   pnpm --dir book-mall ecom:backfill-catalog-thumbs
 *   pnpm --dir book-mall ecom:backfill-catalog-thumbs --dry-run
 */
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import {
  generateAndUploadCatalogThumbFromUrl,
  isCatalogThumbStale,
} from "@/lib/ecom/ecom-catalog-thumb-upload";
import { prisma } from "@/lib/prisma";

const dryRun = process.argv.includes("--dry-run");
const CONCURRENCY = 3;

type BackfillTask = {
  label: string;
  id: string;
  catalogKind: "pose" | "avatar" | "garment" | "full-body";
  ossUrl: string;
  update: (thumbUrl: string) => Promise<void>;
};

async function main() {
  const tasks: BackfillTask[] = [];

  const poses = await prisma.ecomPoseLibraryEntry.findMany({
    where: { deletedAt: null, ossUrl: { not: null } },
    select: { id: true, ossUrl: true, thumbUrl: true },
  });
  for (const row of poses) {
    const ossUrl = row.ossUrl?.trim();
    if (!ossUrl) continue;
    if (!isCatalogThumbStale(row.thumbUrl, ossUrl)) continue;
    tasks.push({
      label: `pose ${row.id}`,
      id: row.id,
      catalogKind: "pose",
      ossUrl,
      update: async (thumbUrl) => {
        await prisma.ecomPoseLibraryEntry.update({
          where: { id: row.id },
          data: { thumbUrl },
        });
      },
    });
  }

  const avatars = await prisma.ecomModelLibraryEntry.findMany({
    where: { deletedAt: null },
    select: { id: true, ossUrl: true, thumbUrl: true },
  });
  for (const row of avatars) {
    const ossUrl = row.ossUrl.trim();
    if (!isCatalogThumbStale(row.thumbUrl, ossUrl)) continue;
    tasks.push({
      label: `avatar ${row.id}`,
      id: row.id,
      catalogKind: "avatar",
      ossUrl,
      update: async (thumbUrl) => {
        await prisma.ecomModelLibraryEntry.update({
          where: { id: row.id },
          data: { thumbUrl },
        });
      },
    });
  }

  const garments = await prisma.ecomGarmentLibraryEntry.findMany({
    where: { deletedAt: null },
    select: { id: true, ossUrl: true, thumbUrl: true },
  });
  for (const row of garments) {
    const ossUrl = row.ossUrl.trim();
    if (!isCatalogThumbStale(row.thumbUrl, ossUrl)) continue;
    tasks.push({
      label: `garment ${row.id}`,
      id: row.id,
      catalogKind: "garment",
      ossUrl,
      update: async (thumbUrl) => {
        await prisma.ecomGarmentLibraryEntry.update({
          where: { id: row.id },
          data: { thumbUrl },
        });
      },
    });
  }

  const fullBodies = await prisma.ecomFullBodyModelEntry.findMany({
    where: { deletedAt: null },
    select: { id: true, ossUrl: true, thumbUrl: true },
  });
  for (const row of fullBodies) {
    const ossUrl = row.ossUrl.trim();
    if (!isCatalogThumbStale(row.thumbUrl, ossUrl)) continue;
    tasks.push({
      label: `full-body ${row.id}`,
      id: row.id,
      catalogKind: "full-body",
      ossUrl,
      update: async (thumbUrl) => {
        await prisma.ecomFullBodyModelEntry.update({
          where: { id: row.id },
          data: { thumbUrl },
        });
      },
    });
  }

  const tryonAssets = await prisma.ecomAsset.findMany({
    where: {
      module: "model-tryon-model",
      kind: "image",
    },
    select: { id: true, ossUrl: true, thumbnailUrl: true },
  });
  for (const row of tryonAssets) {
    const ossUrl = row.ossUrl?.trim();
    if (!ossUrl) continue;
    if (!isCatalogThumbStale(row.thumbnailUrl, ossUrl)) continue;
    tasks.push({
      label: `tryon-asset ${row.id}`,
      id: row.id,
      catalogKind: "full-body",
      ossUrl,
      update: async (thumbUrl) => {
        await prisma.ecomAsset.update({
          where: { id: row.id },
          data: { thumbnailUrl: thumbUrl },
        });
      },
    });
  }

  console.log(
    `[backfill-global-catalog-thumbs] ${dryRun ? "DRY RUN · " : ""}待处理 ${tasks.length} 条`,
  );
  if (tasks.length === 0) return;

  let ok = 0;
  let failed = 0;

  await mapWithConcurrency(
    tasks,
    async (task) => {
      if (dryRun) {
        console.log(`  · would backfill ${task.label}`);
        ok += 1;
        return;
      }
      try {
        const thumbUrl = await generateAndUploadCatalogThumbFromUrl({
          catalogKind: task.catalogKind,
          id: task.id,
          imageUrl: task.ossUrl,
        });
        await task.update(thumbUrl);
        ok += 1;
        console.log(`  ✓ ${task.label}`);
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ✗ ${task.label}: ${msg}`);
      }
    },
    CONCURRENCY,
  );

  console.log(
    `[backfill-global-catalog-thumbs] 完成 · ok=${ok} failed=${failed}${dryRun ? " (dry-run)" : ""}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
