/**
 * 积分换算 1.0 — sbv1 Seedance 分档成本 + 发布挂牌价
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/seed-sbv1-video-credit-prices.ts
 */
import { VIDEO_MODEL_SEEDS } from "../lib/billing/video-model-seeds";
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { prisma } from "../lib/prisma";

const SBV1_CANONICAL_KEYS = [
  "seedance-2.0-720p-real",
  "seedance-2.0-1080p-real",
  "seedance-2.0-fast-720p-real",
  "seedance-pro-1080p",
  "seedance-pro-720p",
] as const;

async function upsertCost(row: (typeof VIDEO_MODEL_SEEDS)[number]) {
  const netCostYuan = row.listCostYuan * (1 - row.discountRate);
  const id = `seed_sbv1_${row.canonicalModelKey}`;
  await prisma.modelCostProfile.upsert({
    where: { id },
    create: {
      id,
      canonicalModelKey: row.canonicalModelKey,
      vendor: row.vendor,
      channel: "CHANNEL",
      unit: "PER_SEC",
      tierRaw: row.tierRaw,
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      netCostYuan,
      active: true,
      note: "seed-sbv1-video-credit-prices",
    },
    update: {
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      netCostYuan,
      active: true,
      note: "seed-sbv1-video-credit-prices",
    },
  });
  console.log(`[cost] ${row.canonicalModelKey}`);
}

async function main() {
  const seeds = VIDEO_MODEL_SEEDS.filter((s) =>
    SBV1_CANONICAL_KEYS.includes(s.canonicalModelKey as (typeof SBV1_CANONICAL_KEYS)[number]),
  );
  if (seeds.length === 0) {
    console.error("未找到 sbv1 分档 seed 定义");
    process.exit(1);
  }

  for (const row of seeds) {
    await upsertCost(row);
  }

  let published = 0;
  let skipped = 0;
  for (const row of seeds) {
    try {
      await publishModelCreditPrice({
        canonicalModelKey: row.canonicalModelKey,
        displayName: row.displayName,
        publishedBy: "seed-sbv1-video",
      });
      console.log(`[publish] ${row.canonicalModelKey}`);
      published++;
    } catch (e) {
      console.warn(
        `[skip] ${row.canonicalModelKey}: ${e instanceof Error ? e.message : String(e)}`,
      );
      skipped++;
    }
  }
  console.log(`[publish] active=${published} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
