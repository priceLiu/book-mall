/**
 * 按 model-margin-policy 重发布全部 active 成本档对应的 ModelCreditPrice。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/republish-model-credit-prices.ts
 */
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { prisma } from "../lib/prisma";

async function main() {
  const profiles = await prisma.modelCostProfile.findMany({
    where: { active: true },
    orderBy: [{ canonicalModelKey: "asc" }, { vendor: "asc" }],
  });

  const byKey = new Map<string, (typeof profiles)[number]>();
  for (const p of profiles) {
    if (!byKey.has(p.canonicalModelKey)) byKey.set(p.canonicalModelKey, p);
  }

  let published = 0;
  let skipped = 0;
  for (const p of byKey.values()) {
    const existing = await prisma.modelCreditPrice.findUnique({
      where: { canonicalModelKey: p.canonicalModelKey },
      select: { displayName: true },
    });
    const displayName =
      existing?.displayName ??
      p.canonicalModelKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    try {
      const r = await publishModelCreditPrice({
        canonicalModelKey: p.canonicalModelKey,
        displayName,
        publishedBy: "republish-model-credit-prices",
      });
      console.log(
        `[ok] ${r.canonicalModelKey} U=${r.creditsPerUnit} P=${r.listPriceYuan.toFixed(4)} margin=${(r.baseMarginRate * 100).toFixed(1)}%`,
      );
      published++;
    } catch (e) {
      console.warn(
        `[skip] ${p.canonicalModelKey}: ${e instanceof Error ? e.message : String(e)}`,
      );
      skipped++;
    }
  }
  console.log(`[done] published=${published} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
