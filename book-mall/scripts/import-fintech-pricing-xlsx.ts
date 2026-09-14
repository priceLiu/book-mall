/**
 * 导入 Fintech AI 第三方报价单 xlsx → ModelCostProfile（RESELLER 渠道）。
 *
 *   pnpm pricing:import-fintech-xlsx -- /path/to/报价单0818.xlsx
 *   pnpm pricing:import-fintech-xlsx -- /path/to/报价单0818.xlsx --dry-run
 *   pnpm pricing:import-fintech-xlsx -- /path/to/报价单0818.xlsx --no-publish
 */
import * as fs from "fs";
import * as path from "path";

import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { importModelCostProfileVersioned } from "../lib/pricing/import-model-cost-profile-versioned";
import {
  FINTECH_COST_VENDOR,
  FINTECH_PRICING_SOURCE,
  parseFintechPricingXlsx,
} from "../lib/pricing/fintech-pricing-xlsx";
import { prisma } from "../lib/prisma";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY_RUN = process.argv.includes("--dry-run");
const NO_PUBLISH = process.argv.includes("--no-publish");

const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../doc/finance/samples/fintech-ai-报价单0818.xlsx",
);

async function main() {
  const xlsxPath = args[0] ? path.resolve(args[0]) : DEFAULT_XLSX;
  if (!fs.existsSync(xlsxPath)) {
    console.error(`文件不存在: ${xlsxPath}`);
    console.error("用法: pnpm pricing:import-fintech-xlsx -- <xlsx路径> [--dry-run] [--no-publish]");
    process.exit(1);
  }

  const buffer = fs.readFileSync(xlsxPath);
  const { rows, skipped } = parseFintechPricingXlsx(buffer);

  console.log(`[fintech] 解析 ${xlsxPath}`);
  console.log(`  可导入: ${rows.length} 条 · 跳过: ${skipped.length} 条`);

  if (rows.length === 0) {
    console.error("无可导入行");
    process.exit(1);
  }

  for (const r of rows) {
    console.log(
      `  · ${r.canonicalModelKey} (${r.vendor}/${r.channel}) ${r.unit} tier=${r.tierRaw ?? "—"} list=¥${r.listCostYuan} disc=${((r.discountRate ?? 0) * 100).toFixed(1)}%`,
    );
  }

  if (skipped.length > 0 && skipped.length <= 30) {
    console.log("\n跳过样例（前 30）:");
    for (const s of skipped.slice(0, 30)) {
      console.log(`  - ${s.reason}`);
    }
  } else if (skipped.length > 30) {
    console.log(`\n跳过 ${skipped.length} 条（未映射或非 Gateway 关注模型）`);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] 未写入数据库");
    return;
  }

  const stale = await prisma.modelCostProfile.updateMany({
    where: {
      active: true,
      channel: "RESELLER",
      note: { contains: FINTECH_PRICING_SOURCE },
      vendor: { not: FINTECH_COST_VENDOR },
    },
    data: { active: false, effectiveTo: new Date() },
  });
  if (stale.count > 0) {
    console.log(`✓ 已停用旧版 Fintech 成本档（vendor≠fintech）: ${stale.count} 条`);
  }

  let upserted = 0;
  const canonicals = new Set<string>();

  for (const row of rows) {
    const seedId = `fintech-${row.canonicalModelKey}-${row.tierRaw ?? "default"}-${row.unit}`.slice(0, 120);
    const result = await importModelCostProfileVersioned({
      ...row,
      seedId,
    });
    if (result.action !== "unchanged") upserted += 1;
    canonicals.add(row.canonicalModelKey);
  }

  console.log(`\n✓ ModelCostProfile upserted/changed: ${upserted}`);

  if (!NO_PUBLISH) {
    let published = 0;
    const errors: string[] = [];
    for (const key of canonicals) {
      try {
        await publishModelCreditPrice({
          canonicalModelKey: key,
          displayName: key,
          publishedBy: "import-fintech-pricing-xlsx",
        });
        published += 1;
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`✓ ModelCreditPrice 发布: ${published}/${canonicals.size}`);
    if (errors.length) {
      console.warn("发布失败（毛利护栏或未过）:");
      for (const e of errors) console.warn(`  - ${e}`);
    }
  } else {
    console.log("(--no-publish) 未重发积分报价");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
