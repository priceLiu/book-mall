/**
 * KIE nano-banana-pro · 清晰度分档成本 + 发布挂牌价
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/seed-lib-nano-pro-credit-prices.ts
 */
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { prisma } from "../lib/prisma";

const TIERS = [
  {
    canonicalModelKey: "lib-nano-pro-1k",
    displayName: "Nano Pro 高清生图 · 1K",
    tierRaw: "1K",
    listCostYuan: 0.04,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "lib-nano-pro-2k",
    displayName: "Nano Pro 高清生图 · 2K",
    tierRaw: "2K",
    listCostYuan: 0.06,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "lib-nano-pro-4k",
    displayName: "Nano Pro 高清生图 · 4K",
    tierRaw: "4K",
    listCostYuan: 0.12,
    discountRate: 0.05,
  },
] as const;

async function upsertCost(row: (typeof TIERS)[number]) {
  const netCostYuan = row.listCostYuan * (1 - row.discountRate);
  const id = `seed_lib_nano_${row.canonicalModelKey}`;
  await prisma.modelCostProfile.upsert({
    where: { id },
    create: {
      id,
      canonicalModelKey: row.canonicalModelKey,
      vendor: "kie",
      channel: "CHANNEL",
      unit: "PER_IMAGE",
      tierRaw: row.tierRaw,
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      netCostYuan,
      active: true,
      note: "seed-lib-nano-pro-credit-prices",
    },
    update: {
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      netCostYuan,
      active: true,
      note: "seed-lib-nano-pro-credit-prices",
    },
  });
  console.log(`[cost] ${row.canonicalModelKey}`);
}

async function syncOfferingCredits(defaultTierKey: string) {
  const price = await prisma.modelCreditPrice.findUnique({
    where: { canonicalModelKey: defaultTierKey },
    select: { creditsPerUnit: true },
  });
  if (!price) return;
  await prisma.appModelOffering.updateMany({
    where: { canonicalModelKey: "lib-nano-pro", status: "ACTIVE" },
    data: { publishedCreditsPerUnit: price.creditsPerUnit },
  });
  console.log(
    `[offering] lib-nano-pro publishedCreditsPerUnit=${price.creditsPerUnit} (from ${defaultTierKey})`,
  );
}

async function main() {
  for (const row of TIERS) {
    await upsertCost(row);
  }

  let published = 0;
  let skipped = 0;
  for (const row of TIERS) {
    try {
      await publishModelCreditPrice({
        canonicalModelKey: row.canonicalModelKey,
        displayName: row.displayName,
        publishedBy: "seed-lib-nano-pro",
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

  await syncOfferingCredits("lib-nano-pro-2k");

  await prisma.modelCreditPrice.updateMany({
    where: { canonicalModelKey: "lib-nano-pro" },
    data: { active: false },
  });
  console.log("[cleanup] deactivated legacy lib-nano-pro aggregate price");

  console.log(`[done] published=${published} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
