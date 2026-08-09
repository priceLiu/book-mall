/**
 * 仅发布 KIE 价目导入产生的 ModelCreditPrice（不跑 autoPublishPlatformOfferings）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/publish-kie-credit-prices.ts
 */
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";
import { prisma } from "../lib/prisma";

async function main() {
  const profiles = await prisma.modelCostProfile.findMany({
    where: { active: true, vendor: "kie", note: { contains: "docs/price/kie.md" } },
    select: { canonicalModelKey: true },
  });
  const keys = [...new Set(profiles.map((p) => p.canonicalModelKey))];
  console.log(`[kie] publishing ${keys.length} canonicals…`);
  let ok = 0;
  let skip = 0;
  for (const canonical of keys.sort()) {
    const def = GATEWAY_CANONICAL_REGISTRY.find((d) => d.canonicalModelKey === canonical);
    try {
      const r = await publishModelCreditPrice({
        canonicalModelKey: canonical,
        displayName: def?.displayName ?? canonical,
        publishedBy: "pricing-import-kie-scoped",
      });
      console.log(
        `[ok] ${r.canonicalModelKey} U=${r.creditsPerUnit} P=${r.listPriceYuan.toFixed(4)}`,
      );
      ok += 1;
    } catch (e) {
      console.warn(`[skip] ${canonical}:`, e instanceof Error ? e.message : e);
      skip += 1;
    }
  }
  console.log(`[done] ok=${ok} skip=${skip}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
