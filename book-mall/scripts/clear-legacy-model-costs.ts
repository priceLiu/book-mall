/**
 * 删除不在 Gateway 统一注册表内的 ModelCostProfile / ModelCreditPrice。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/clear-legacy-model-costs.ts --confirm
 */
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";
import { prisma } from "../lib/prisma";

async function main() {
  const confirm = process.argv.includes("--confirm");
  const registryKeys = GATEWAY_CANONICAL_REGISTRY.map((c) => c.canonicalModelKey);

  const legacyProfiles = await prisma.modelCostProfile.findMany({
    where: { canonicalModelKey: { notIn: registryKeys } },
    select: { id: true, canonicalModelKey: true, vendor: true, tierRaw: true },
    orderBy: [{ canonicalModelKey: "asc" }, { vendor: "asc" }],
  });

  const legacyPrices = await prisma.modelCreditPrice.findMany({
    where: { canonicalModelKey: { notIn: registryKeys } },
    select: { id: true, canonicalModelKey: true },
    orderBy: { canonicalModelKey: "asc" },
  });

  const legacyKeys = [...new Set(legacyProfiles.map((p) => p.canonicalModelKey))];
  console.log(`遗留成本档：${legacyProfiles.length} 条，${legacyKeys.length} 个 canonical`);
  for (const k of legacyKeys) {
    const n = legacyProfiles.filter((p) => p.canonicalModelKey === k).length;
    console.log(`  ${k}: ${n} 条`);
  }
  console.log(`遗留积分报价 ModelCreditPrice：${legacyPrices.length} 条`);

  if (!confirm) {
    console.log("请加 --confirm 执行删除。");
    return;
  }

  const [delProfiles, delPrices] = await prisma.$transaction([
    prisma.modelCostProfile.deleteMany({
      where: { canonicalModelKey: { notIn: registryKeys } },
    }),
    prisma.modelCreditPrice.deleteMany({
      where: { canonicalModelKey: { notIn: registryKeys } },
    }),
  ]);

  console.log(`已删除 ModelCostProfile ${delProfiles.count} 条，ModelCreditPrice ${delPrices.count} 条。`);
  console.log(
    `剩余成本档 ${await prisma.modelCostProfile.count()} 条，去重 canonical ${registryKeys.length} 个。`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
