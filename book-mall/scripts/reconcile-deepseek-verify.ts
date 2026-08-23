/**
 * DeepSeek 对账 dry-run：解析 CSV + 聚合 Gateway + reconcile（不写库）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/reconcile-deepseek-verify.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDeepseekUsageBillCsvSync } from "../lib/finance/reconciliation-v2/deepseek-usage-v2-adapter";
import { rollupDeepseekPlatformLinesForCostMatch } from "../lib/finance/reconciliation-v2/deepseek-platform-rollup";
import { aggregatePlatformUsageForReconciliation } from "../lib/finance/reconciliation-v2/platform-usage-aggregator";
import { countByStatus, reconcileVendorAndPlatform } from "../lib/finance/reconciliation-v2/reconcile-engine";
import { prisma } from "../lib/prisma";

const FIXTURE_COST = join(process.cwd(), "test/fixtures/deepseek-cost-sample.csv");
const FIXTURE_AMOUNT = join(process.cwd(), "test/fixtures/deepseek-amount-sample.csv");
const USER_COST =
  "/Users/vic.liu/.cursor/projects/Users-vic-liu-Documents-doing-private-website/attachments/b381bae4-2798-4d88-85c0-a2c3ef3146b9/cost-2026-07-24_2026-08-22.csv";
const USER_AMOUNT =
  "/Users/vic.liu/.cursor/projects/Users-vic-liu-Documents-doing-private-website/attachments/b381bae4-2798-4d88-85c0-a2c3ef3146b9/amount-2026-07-24_2026-08-22.csv";

async function runVerify(label: string, costCsv: string, amountCsv: string) {
  const parsed = parseDeepseekUsageBillCsvSync(costCsv, { extraCsv: amountCsv });
  let platformLines = (
    await aggregatePlatformUsageForReconciliation({ period: parsed.period })
  ).filter((p) => p.vendor === "deepseek");

  if (parsed.source === "cost") {
    platformLines = rollupDeepseekPlatformLinesForCostMatch(platformLines, parsed.lines);
  }

  const resultLines = reconcileVendorAndPlatform(parsed.lines, platformLines);
  const statusCounts = countByStatus(resultLines);

  console.log(`\n=== ${label} ===`);
  console.log("period", parsed.period, "source", parsed.source);
  console.log("vendor lines", parsed.lines.length, "platform lines", platformLines.length);
  console.log("statusCounts", statusCounts);
  console.log(
    "vendor CNY",
    parsed.lines.reduce((s, l) => s + l.vendorListYuan, 0).toFixed(2),
    "platform CNY",
    resultLines.reduce((s, r) => s + r.platformListYuan, 0).toFixed(2),
  );
  for (const r of resultLines.slice(0, 12)) {
    console.log(
      `  ${r.reconStatus} ${r.modelKey}|${r.tokenDirection} vendor=${r.vendorUnits.toFixed(1)}/${r.vendorListYuan.toFixed(2)} platform=${r.platformUnits.toFixed(1)}/${r.platformListYuan.toFixed(2)}`,
    );
  }
}

async function main() {
  await runVerify("fixtures", readFileSync(FIXTURE_COST, "utf8"), readFileSync(FIXTURE_AMOUNT, "utf8"));
  try {
    await runVerify(
      "user CSV",
      readFileSync(USER_COST, "utf8"),
      readFileSync(USER_AMOUNT, "utf8"),
    );
  } catch (e) {
    console.warn("User CSV skip:", (e as Error).message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
