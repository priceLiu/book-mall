/* eslint-disable no-console */
/**
 * 将指定用户的电商「我的资产」成图批量晋升为 platform scope 全局 catalog。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-global-catalog-from-ecom-assets.ts
 *
 * 可选：--email=13808816802@126.com --limit=120 --dry-run
 */
import { importCatalogFromImage } from "../lib/ecom/ecom-catalog-import-from-image";
import type { GlobalAssetCatalogKind } from "../lib/ecom/ecom-global-asset-catalog";
import { ECOM_MODEL_SHOT_MODULE } from "../lib/ecom/ecom-model-shot-types";
import { ECOM_MODEL_TRYON_MODULE } from "../lib/ecom/ecom-model-tryon-types";
import { ECOM_VTON_MODEL_ASSET_MODULE } from "../lib/ecom/ecom-vton/types";
import { prisma } from "../lib/prisma";

const DEFAULT_EMAIL = "13808816802@126.com";

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function resolveCatalogKind(module: string): GlobalAssetCatalogKind {
  if (module === ECOM_MODEL_SHOT_MODULE) return "pose";
  if (module === ECOM_VTON_MODEL_ASSET_MODULE) return "full-body";
  if (module === ECOM_MODEL_TRYON_MODULE) return "garment";
  if (module.includes("outfit") || module.includes("full-body")) return "full-body";
  if (module.includes("garment") || module.includes("main-image") || module.includes("detail")) {
    return "garment";
  }
  return "garment";
}

async function main() {
  const email = parseArg("email") ?? DEFAULT_EMAIL;
  const limit = Math.min(Math.max(Number(parseArg("limit") ?? "120"), 1), 500);
  const dryRun = process.argv.includes("--dry-run");

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone: email.replace(/@.*$/, "") }],
    },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(`未找到用户：${email}`);
  }

  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId: user.id,
      kind: "image",
      ossUrl: { startsWith: "https://" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      module: true,
      title: true,
      prompt: true,
      ossUrl: true,
    },
  });

  console.log(
    `[seed-global-catalog] user=${user.email ?? user.id} assets=${assets.length} dryRun=${dryRun}`,
  );

  let ok = 0;
  let dup = 0;
  let fail = 0;

  for (const asset of assets) {
    const catalogKind = resolveCatalogKind(asset.module);
    const name = asset.title?.trim() || `${catalogKind}-${asset.id.slice(0, 8)}`;
    console.log(`  · ${catalogKind} ← ${asset.module} · ${name}`);

    if (dryRun) {
      ok += 1;
      continue;
    }

    try {
      const result = await importCatalogFromImage({
        catalogKind,
        imageUrl: asset.ossUrl,
        actorUserId: user.id,
        isPlatformAdmin: true,
        scope: "platform",
        name,
        savePrompt: Boolean(asset.prompt?.trim()),
        prompt: asset.prompt ?? undefined,
        sourceModule: asset.module,
        sourceAssetId: asset.id,
      });
      if (result.ok) {
        ok += 1;
      } else {
        dup += 1;
        console.log(`    duplicate → ${result.existingId}`);
      }
    } catch (e) {
      fail += 1;
      console.error(`    FAIL ${asset.id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`[seed-global-catalog] done ok=${ok} duplicate=${dup} fail=${fail}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
