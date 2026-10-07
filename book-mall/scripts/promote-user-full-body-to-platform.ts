/* eslint-disable no-console */
/**
 * 将指定用户账号下的「全身模特」复制进 platform 全局库（保留 user 原条目）。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/promote-user-full-body-to-platform.ts
 *   ... --email=you@example.com --dry-run
 */
import { importCatalogFromImage } from "../lib/ecom/ecom-catalog-import-from-image";
import { createFullBodyModelFromImport } from "../lib/ecom/ecom-full-body-model-library-service";
import { prisma } from "../lib/prisma";

const DEFAULT_EMAIL = "13808816802@126.com";

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function platformFullBodyExists(ossUrl: string): Promise<boolean> {
  const url = ossUrl.trim();
  if (!url) return true;
  const row = await prisma.ecomFullBodyModelEntry.findFirst({
    where: {
      deletedAt: null,
      enabled: true,
      scope: "platform",
      OR: [{ ossUrl: url }, { thumbUrl: url }],
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function copyUserFullBodyRowToPlatform(row: {
  id: string;
  name: string;
  gender: string;
  ossUrl: string;
  thumbUrl: string | null;
  sourceAssetId: string | null;
}): Promise<"created" | "skip"> {
  if (await platformFullBodyExists(row.ossUrl)) return "skip";
  const gender = row.gender === "male" ? "male" : "female";
  await createFullBodyModelFromImport({
    name: row.name,
    gender,
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl ?? row.ossUrl,
    sourceAssetId: row.sourceAssetId ?? row.id,
    scope: "platform",
    userId: "promote-script",
  });
  return "created";
}

async function main() {
  const email = parseArg("email") ?? DEFAULT_EMAIL;
  const dryRun = process.argv.includes("--dry-run");

  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone: email.replace(/@.*$/, "") }] },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`未找到用户：${email}`);

  const userFullBodies = await prisma.ecomFullBodyModelEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      scope: "user",
      userId: user.id,
    },
    orderBy: { createdAt: "desc" },
  });

  const fullBodyAvatars = await prisma.ecomModelLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      scope: "user",
      userId: user.id,
      OR: [
        { name: { contains: "全身" } },
        { name: { contains: "full-body", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const tryonAssets = await prisma.ecomAsset.findMany({
    where: {
      userId: user.id,
      kind: "image",
      module: "model-tryon-model",
      ossUrl: { startsWith: "https://" },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  console.log(
    `[promote-full-body] user=${user.email ?? user.id} ` +
      `userFb=${userFullBodies.length} avatar全身=${fullBodyAvatars.length} tryon=${tryonAssets.length} dryRun=${dryRun}`,
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of userFullBodies) {
    console.log(`  · EcomFullBodyModelEntry ${row.name}`);
    if (dryRun) {
      created += 1;
      continue;
    }
    try {
      const r = await copyUserFullBodyRowToPlatform(row);
      if (r === "created") created += 1;
      else skipped += 1;
    } catch (e) {
      failed += 1;
      console.error("    FAIL", e instanceof Error ? e.message : e);
    }
  }

  for (const row of fullBodyAvatars) {
    console.log(`  · ModelLibrary(全身) ${row.name}`);
    if (dryRun) {
      created += 1;
      continue;
    }
    try {
      const r = await copyUserFullBodyRowToPlatform({
        id: row.id,
        name: row.name,
        gender: row.gender,
        ossUrl: row.ossUrl,
        thumbUrl: row.thumbUrl,
        sourceAssetId: row.id,
      });
      if (r === "created") created += 1;
      else skipped += 1;
    } catch (e) {
      failed += 1;
      console.error("    FAIL", e instanceof Error ? e.message : e);
    }
  }

  for (const asset of tryonAssets) {
    const name = asset.title?.trim() || `全身模特-${asset.id.slice(0, 8)}`;
    console.log(`  · tryon asset ${name}`);
    if (dryRun) {
      created += 1;
      continue;
    }
    try {
      if (await platformFullBodyExists(asset.ossUrl)) {
        skipped += 1;
        continue;
      }
      const dup = await importCatalogFromImage({
        catalogKind: "full-body",
        imageUrl: asset.ossUrl,
        actorUserId: user.id,
        isPlatformAdmin: true,
        scope: "platform",
        name,
        sourceModule: asset.module,
        sourceAssetId: asset.id,
      });
      if (dup.ok) created += 1;
      else skipped += 1;
    } catch (e) {
      failed += 1;
      console.error("    FAIL", e instanceof Error ? e.message : e);
    }
  }

  const platformCount = await prisma.ecomFullBodyModelEntry.count({
    where: { deletedAt: null, enabled: true, scope: "platform" },
  });

  console.log(
    `[promote-full-body] done created=${created} skipped=${skipped} fail=${failed} platformTotal=${platformCount}`,
  );
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
