/**
 * 对比 Gateway KIE 路由价目与 ModelCostProfile（kie.md 导入结果）。
 *
 *   pnpm pricing:audit-gateway-vs-kie
 */
import { prisma } from "../lib/prisma";
import { collectGatewayKieRoutes } from "../lib/pricing/collect-gateway-kie-routes";
import { fetchAllKiePricingRows } from "../lib/pricing/kie-pricing-api";
import {
  resolveKieRoutePrice,
  specToListCostYuan,
} from "../lib/pricing/kie-pricing-match";

async function main() {
  const rows = await fetchAllKiePricingRows();
  const routes = collectGatewayKieRoutes();
  const missing: string[] = [];
  const mismatches: string[] = [];
  const checked = new Set<string>();

  for (const route of routes) {
    const resolved = resolveKieRoutePrice(route, rows);
    if (!resolved) {
      missing.push(`${route.canonicalModelKey} ← ${route.modelKey} (kie.ai 无匹配行)`);
      continue;
    }
    const expected = specToListCostYuan(resolved);
    const key = `${route.canonicalModelKey}|${expected.unit}|${expected.tierRaw ?? ""}`;
    if (checked.has(key)) continue;
    checked.add(key);

    const profiles = await prisma.modelCostProfile.findMany({
      where: {
        canonicalModelKey: route.canonicalModelKey,
        vendor: "kie",
        active: true,
        unit: expected.unit,
        tierRaw: expected.tierRaw ?? null,
      },
    });
    if (profiles.length === 0) {
      mismatches.push(`${route.canonicalModelKey}: 无 KIE ModelCostProfile (${expected.unit})`);
      continue;
    }
    const p = profiles[0]!;
    const got = Number(p.listCostYuan);
    if (Math.abs(got - expected.listCostYuan) > 1e-5 && got < expected.listCostYuan - 1e-5) {
      mismatches.push(
        `${route.canonicalModelKey}: 期望 ≥${expected.listCostYuan.toFixed(6)} 实际 ${got.toFixed(6)}`,
      );
    }
  }

  console.log(`Gateway KIE 路由数: ${routes.length}`);
  if (missing.length) {
    console.warn(`\n✗ kie.ai 无匹配价目 (${missing.length}):`);
    for (const m of missing) console.warn(`  - ${m}`);
  }
  if (mismatches.length) {
    console.warn(`\n✗ 成本档不一致 (${mismatches.length}):`);
    for (const m of mismatches) console.warn(`  - ${m}`);
  }
  if (!missing.length && !mismatches.length) {
    console.log("✓ Gateway KIE 路由价目与 ModelCostProfile 一致。");
  } else {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
