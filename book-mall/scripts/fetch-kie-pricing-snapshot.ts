/**
 * 抓取 kie.ai 价目并写入 docs/price/kie.md（仅 Gateway KIE 路由 scope）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/fetch-kie-pricing-snapshot.ts
 */
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

import { collectGatewayKieRoutes } from "../lib/pricing/collect-gateway-kie-routes";
import { fetchAllKiePricingRows } from "../lib/pricing/kie-pricing-api";
import {
  KIE_CREDIT_YUAN,
  KIE_PRICING_SOURCE_URL,
  kieCreditsToYuan,
} from "../lib/pricing/kie-pricing-constants";
import {
  LIB_NANO_PRO_KIE_TIER_RULES,
  resolveKieRoutePrice,
  resolveLibNanoProTierPrice,
  specToListCostYuan,
} from "../lib/pricing/kie-pricing-match";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURED_AT = "2026-08-08";

async function main() {
  const rows = await fetchAllKiePricingRows();
  const routes = collectGatewayKieRoutes();
  const lines: string[] = [
    "# KIE 价目镜像（Gateway scope）",
    "",
    `> capturedAt: ${CAPTURED_AT}`,
    `> source: ${KIE_PRICING_SOURCE_URL}`,
    `> api: https://api.kie.ai/client/v1/model-pricing/page`,
    `> kieCreditYuan: ${KIE_CREDIT_YUAN}（标准充值档 ¥36/1000 积分）`,
    `> scope: gateway-only · 排除 HappyHorse`,
    `> formula: listCostYuan = kieCredits × ${KIE_CREDIT_YUAN}`,
    "",
    "| canonical | gatewayModelKey | tierRaw | kieCredits | listCostYuan | usdCheck | billingUnit | kieDescription |",
    "| --- | --- | --- | ---: | ---: | --- | --- | --- |",
  ];

  const seenCanonical = new Set<string>();

  for (const route of routes) {
    const resolved = resolveKieRoutePrice(route, rows);
    if (!resolved) {
      lines.push(
        `| ${route.canonicalModelKey} | ${route.modelKey} | — | — | — | — | — | **MISSING** |`,
      );
      continue;
    }
    const cost = specToListCostYuan(resolved);
    let kieCredits = "";
    if (resolved.kind === "token") {
      kieCredits = `in ${resolved.inputCreditsPerMillion} / out ${resolved.outputCreditsPerMillion} /M`;
    } else if (resolved.kind === "image") {
      kieCredits = String(resolved.kieCreditsPerImage);
    } else if (resolved.kind === "video") {
      kieCredits = `${resolved.kieCreditsPerSecond}/s`;
    } else {
      kieCredits = String(resolved.kieCreditsPerCall);
    }
    lines.push(
      `| ${route.canonicalModelKey} | ${route.modelKey} | ${cost.tierRaw ?? "—"} | ${kieCredits} | ${cost.listCostYuan.toFixed(6)} | ${resolved.usdCheck ?? "—"} | ${cost.unit} | ${resolved.modelDescription.replace(/\|/g, "\\|")} |`,
    );
    seenCanonical.add(route.canonicalModelKey);
  }

  for (const tier of LIB_NANO_PRO_KIE_TIER_RULES) {
    const resolved = resolveLibNanoProTierPrice(tier, rows);
    if (!resolved || resolved.kind !== "image") continue;
    const cost = specToListCostYuan(resolved);
    lines.push(
      `| ${tier.canonicalModelKey} | nano-banana-pro | ${tier.tierRaw} | ${resolved.kieCreditsPerImage} | ${cost.listCostYuan.toFixed(6)} | ${resolved.usdCheck ?? "—"} | PER_IMAGE | ${resolved.modelDescription.replace(/\|/g, "\\|")} |`,
    );
  }

  const outPath = path.resolve(__dirname, "../../docs/price/kie.md");
  const body = lines.join("\n") + "\n";
  fs.writeFileSync(outPath, body, "utf8");
  const sha = createHash("sha256").update(body).digest("hex");
  console.log(`Wrote ${outPath} (${routes.length} routes, sha256=${sha.slice(0, 12)}…)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
