/**
 * Seedream 图层拆分 · LAYER 成本档 + 积分挂牌
 *
 *   pnpm --filter book-mall exec dotenv -e .env.local -- tsx scripts/seed-seedream-layer-credit-tiers.ts
 */
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { importModelCostProfileVersioned } from "../lib/pricing/import-model-cost-profile-versioned";

const ROWS = [
  {
    canonicalModelKey: "doubao-seedream-5-0-pro",
    displayName: "Doubao Seedream 5.0 Pro",
    vendor: "volcengine",
    listCostYuan: 0.15,
    discountRate: 0.08,
    tierRaw: "LAYER",
    seedId: "seed_seedream_pro_layer_202603",
  },
  {
    canonicalModelKey: "doubao-seedream-5-5",
    displayName: "Doubao Seedream 5.5",
    vendor: "volcengine",
    listCostYuan: 0.13,
    discountRate: 0.08,
    tierRaw: "LAYER",
    seedId: "seed_seedream_55_layer_202603",
  },
] as const;

async function main() {
  for (const row of ROWS) {
    const r = await importModelCostProfileVersioned({
      canonicalModelKey: row.canonicalModelKey,
      vendor: row.vendor,
      unit: "PER_IMAGE",
      tierRaw: row.tierRaw,
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      note: "方舟图层拆分 · tierRaw=LAYER",
      seedId: row.seedId,
    });
    console.log(`[cost ${r.action}] ${row.canonicalModelKey} · ${row.tierRaw}`);
    const p = await publishModelCreditPrice({
      canonicalModelKey: row.canonicalModelKey,
      displayName: `${row.displayName} · LAYER`,
      tierRaw: row.tierRaw,
      publishedBy: "seed-seedream-layer-credit-tiers",
    });
    console.log(
      `[price] ${row.canonicalModelKey} · ${row.tierRaw} → ${p.creditsPerUnit} credits/layer`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});