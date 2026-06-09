/**
 * 统一积分计费首版数据落库：
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-credit-billing.ts
 *
 * 幂等，可重复执行。落库套餐/席位带/BYOK 配置/示例成本档并发布首版报价快照。
 */
import { seedUnifiedCreditBilling } from "../lib/billing/seed-credit-billing";
import { prisma } from "../lib/prisma";

async function main() {
  const r = await seedUnifiedCreditBilling("seed-script");
  console.log("[seed-credit-billing] 套餐档位:", r.plans, "成本档:", r.costProfiles, "视频模型:", r.videoModels);
  console.log("[seed-credit-billing] 已发布报价:");
  for (const p of r.published) {
    console.log(`  - ${p.canonicalModelKey}: ${p.creditsPerUnit} 积分/单位, 毛利 ${(p.baseMarginRate * 100).toFixed(1)}%`);
  }
  if (r.publishErrors.length > 0) {
    console.warn("[seed-credit-billing] 发布失败（含毛利护栏拦截）:");
    for (const e of r.publishErrors) console.warn(`  - ${e.canonicalModelKey}: ${e.error}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
