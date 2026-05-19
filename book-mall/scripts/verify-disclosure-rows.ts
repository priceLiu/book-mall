/**
 * 验收脚本：调用 getEffectiveBillablePricesForDisclosure，确认：
 *  - 同模型多档位独立成行
 *  - 厂商产品/商品名 join 上来
 *  - cost / M / pricePoints 对得齐
 *
 * 用法（book-mall 下）：
 *   pnpm dotenv -e .env.local -- tsx scripts/verify-disclosure-rows.ts
 */
import {
  getEffectiveBillablePricesForDisclosure,
  describeUnitForDisclosure,
} from "../lib/pricing-disclosure";
import { prisma } from "../lib/prisma";

async function main() {
  const rows = await getEffectiveBillablePricesForDisclosure();
  console.log(`公示行数：${rows.length}`);

  // 看 happyhorse-1.0-i2v 应有 720P / 1080P 两行
  const hh = rows.filter((r) => r.schemeARefModelKey === "happyhorse-1.0-i2v");
  console.log(`\nhappyhorse-1.0-i2v：${hh.length} 行`);
  for (const r of hh) {
    const ours =
      r.schemeAUnitCostYuan != null && r.retailMultiplier != null
        ? r.schemeAUnitCostYuan * r.retailMultiplier
        : null;
    console.log(
      `  tier=${r.cloudTierRaw} | cost=¥${r.schemeAUnitCostYuan} | M=${r.retailMultiplier} | 我方=¥${ours} | pp=${r.pricePoints} | unit=${describeUnitForDisclosure(r.cloudBillingKind, r.cloudTierRaw)} | 产品=${r.vendorProductName ?? "-"} | 商品=${r.vendorCommodityName ?? "-"}`,
    );
  }

  // 看 wan2.6-i2v-flash 应有 4 行
  const flash = rows.filter((r) => r.schemeARefModelKey === "wan2.6-i2v-flash");
  console.log(`\nwan2.6-i2v-flash：${flash.length} 行（按 audio/silent 拆）`);
  for (const r of flash) {
    const ours =
      r.schemeAUnitCostYuan != null && r.retailMultiplier != null
        ? r.schemeAUnitCostYuan * r.retailMultiplier
        : null;
    console.log(
      `  tier=${r.cloudTierRaw} | cost=¥${r.schemeAUnitCostYuan} | 我方=¥${ours} | pp=${r.pricePoints}`,
    );
  }

  // 千问 / 视觉分析
  const vl = rows.filter((r) => r.toolKey === "visual-lab__analysis");
  console.log(`\nvisual-lab__analysis：${vl.length} 行`);
  for (const r of vl) {
    console.log(
      `  ${r.schemeARefModelKey} | tier=${r.cloudTierRaw} | cost=¥${r.schemeAUnitCostYuan}/百万 token (折算) | pp=${r.pricePoints} (每次固定)`,
    );
  }

  // 总览
  const byTool = new Map<string, number>();
  for (const r of rows) byTool.set(r.toolKey, (byTool.get(r.toolKey) ?? 0) + 1);
  console.log("\n按 toolKey 行数：");
  for (const [k, n] of byTool) console.log(`  ${k.padEnd(28)} ${n} 行`);

  // 验收点
  const errors: string[] = [];
  if (hh.length !== 2) errors.push(`happyhorse-1.0-i2v 应 2 行, 实际 ${hh.length}`);
  if (flash.length !== 4) errors.push(`wan2.6-i2v-flash 应 4 行, 实际 ${flash.length}`);
  if (vl.length !== 8) errors.push(`visual-lab__analysis 应 8 行, 实际 ${vl.length}`);
  // 关键 happyhorse 1080P：cost=1.6 / 我方=3.2 / pp=320
  const hh1080 = hh.find((r) => r.cloudTierRaw === "1080P");
  if (
    !hh1080 ||
    hh1080.schemeAUnitCostYuan !== 1.6 ||
    hh1080.retailMultiplier !== 2 ||
    hh1080.pricePoints !== 320
  ) {
    errors.push(`happyhorse 1080P 期望 cost=1.6/M=2/pp=320, 实际 ${JSON.stringify(hh1080)}`);
  }

  if (errors.length === 0) {
    console.log("\n✅ 公示数据全部符合预期。");
  } else {
    console.log("\n❌ 偏差：");
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
