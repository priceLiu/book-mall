/**
 * 对比 Gateway 百炼路由价目与 gateway-bailian-price-catalog（ali.md 华北2 原价）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/pricing-audit-gateway-vs-ali.ts
 */
import { prisma } from "../lib/prisma";
import { collectGatewayAliyunRoutes } from "../lib/pricing/collect-gateway-aliyun-routes";
import {
  GATEWAY_ALI_PRICE_BY_MODEL_KEY,
  ktokenFromMillion,
  type GatewayAliPriceSpec,
} from "../lib/pricing/gateway-bailian-price-catalog";

function resolveSpec(modelKey: string): GatewayAliPriceSpec | null {
  const k = modelKey.trim();
  return GATEWAY_ALI_PRICE_BY_MODEL_KEY[k] ?? GATEWAY_ALI_PRICE_BY_MODEL_KEY[k.toLowerCase()] ?? null;
}

async function main() {
  const routes = collectGatewayAliyunRoutes();
  const missing: string[] = [];
  const mismatches: string[] = [];
  const checkedVideoTier = new Set<string>();

  for (const route of routes) {
    const spec = resolveSpec(route.modelKey);
    if (!spec) {
      missing.push(`${route.canonicalModelKey} ← ${route.modelKey}`);
      continue;
    }
    const profiles = await prisma.modelCostProfile.findMany({
      where: { canonicalModelKey: route.canonicalModelKey, active: true },
    });
    if (profiles.length === 0) {
      mismatches.push(`${route.canonicalModelKey}: 无 ModelCostProfile`);
      continue;
    }
    if (spec.kind === "token") {
      const p =
        profiles.find(
          (x) => x.unit === "PER_KTOKEN" && x.inputListCostYuan != null && x.outputListCostYuan != null,
        ) ?? profiles.find((x) => x.unit === "PER_KTOKEN");
      if (!p) {
        mismatches.push(`${route.canonicalModelKey}: 缺 PER_KTOKEN 成本档`);
        continue;
      }
      const inK = ktokenFromMillion(spec.inputYuanPerMillion);
      const outK = ktokenFromMillion(spec.outputYuanPerMillion);
      const gotIn = Number(p.inputListCostYuan ?? p.listCostYuan);
      const gotOut = Number(p.outputListCostYuan ?? 0);
      if (Math.abs(gotIn - inK) > 1e-6 || Math.abs(gotOut - outK) > 1e-6) {
        mismatches.push(
          `${route.canonicalModelKey}: token in/out 期望 ${inK}/${outK} 实际 ${gotIn}/${gotOut}`,
        );
      }
    } else if (spec.kind === "image") {
      const p = profiles.find((x) => x.unit === "PER_IMAGE");
      if (!p || Math.abs(Number(p.listCostYuan) - spec.yuanPerImage) > 1e-6) {
        mismatches.push(`${route.canonicalModelKey}: image 价目不一致`);
      }
    } else if (spec.kind === "audio") {
      const p = profiles.find((x) => x.unit === "PER_SEC");
      if (!p || Math.abs(Number(p.listCostYuan) - spec.yuanPerSecond) > 1e-8) {
        mismatches.push(`${route.canonicalModelKey}: ASR 价目不一致`);
      }
    } else if (spec.kind === "video") {
      for (const [tier, yps] of Object.entries(spec.yuanPerSecondByTier)) {
        const tierKey = `${route.canonicalModelKey}@${tier}`;
        if (checkedVideoTier.has(tierKey)) continue;
        checkedVideoTier.add(tierKey);
        const p = profiles.find((x) => x.tierRaw === tier);
        const siblingRoutes = routes.filter((r) => r.canonicalModelKey === route.canonicalModelKey);
        const allowedPrices = siblingRoutes.flatMap((r) => {
          const s = resolveSpec(r.modelKey);
          if (s?.kind !== "video") return [];
          return s.yuanPerSecondByTier[tier] != null ? [s.yuanPerSecondByTier[tier]] : [];
        });
        const ok =
          p != null &&
          allowedPrices.some((price) => Math.abs(Number(p.listCostYuan) - price) <= 1e-6);
        if (!ok) {
          mismatches.push(
            `${tierKey}: video 价目不一致（期望 ${allowedPrices.join("/")} 之一，实际 ${p ? Number(p.listCostYuan) : "缺失"}）`,
          );
        }
      }
    }
  }

  const prices = await prisma.modelCreditPrice.findMany({
    where: { active: true },
    select: { canonicalModelKey: true },
  });
  const priced = new Set(prices.map((p) => p.canonicalModelKey));
  const canonicals = new Set(routes.map((r) => r.canonicalModelKey));
  const missingPrices = [...canonicals].filter((k) => !priced.has(k));

  console.log(`Gateway 百炼/DashScope 路由: ${routes.length}`);
  if (missing.length) {
    console.error(`\n✗ catalog 缺价目 (${missing.length}):`);
    for (const m of missing) console.error(`  - ${m}`);
  }
  if (mismatches.length) {
    console.error(`\n✗ DB 价目不一致 (${mismatches.length}):`);
    for (const m of mismatches) console.error(`  - ${m}`);
  }
  if (missingPrices.length) {
    console.error(`\n✗ 未发布 ModelCreditPrice (${missingPrices.length}):`);
    for (const k of missingPrices.sort()) console.error(`  - ${k}`);
  }
  if (missing.length || mismatches.length || missingPrices.length) {
    process.exit(1);
  }
  console.log("✓ Gateway 百炼价目与 ali.md catalog / DB 一致。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
