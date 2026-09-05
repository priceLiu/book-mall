/**
 * 电商图像处理 · 平台积分成本档 + 挂牌价
 *
 *   pnpm --filter book-mall seed:ecom-image-processing-credits
 */
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { importModelCostProfileVersioned } from "../lib/pricing/import-model-cost-profile-versioned";
import { prisma } from "../lib/prisma";

const ROWS = [
  {
    canonicalModelKey: "qwen-image-edit",
    displayName: "Qwen 图像编辑",
    vendor: "aliyun",
    listCostYuan: 0.14,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "qwen-image-edit-max",
    displayName: "Qwen 图像编辑 Max",
    vendor: "aliyun",
    listCostYuan: 0.28,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "doubao-seedream-5-0-lite",
    displayName: "Doubao Seedream 5.0 Lite",
    vendor: "volcengine",
    listCostYuan: 0.25,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "image-out-painting",
    displayName: "百炼 · 图像画面扩展",
    vendor: "aliyun",
    listCostYuan: 0.18,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wanx-x-painting",
    displayName: "万相 · 图像局部重绘",
    vendor: "aliyun",
    listCostYuan: 0.01,
    discountRate: 0,
  },
  {
    canonicalModelKey: "wan2.5-i2i-preview",
    displayName: "万相 2.5 · 图像编辑",
    vendor: "aliyun",
    listCostYuan: 0.2,
    discountRate: 0.1,
  },
] as const;

async function upsertCost(row: (typeof ROWS)[number]) {
  const result = await importModelCostProfileVersioned({
    canonicalModelKey: row.canonicalModelKey,
    vendor: row.vendor,
    unit: "PER_IMAGE",
    listCostYuan: row.listCostYuan,
    discountRate: row.discountRate,
    note: "seed-ecom-image-processing-credit-prices",
    seedId: `seed_ecom_imgproc_${row.canonicalModelKey}`,
  });
  console.log(
    `[${result.action}] ${row.canonicalModelKey} list=${row.listCostYuan}`,
  );
}

async function main() {
  for (const row of ROWS) {
    await upsertCost(row);
  }

  let published = 0;
  for (const row of ROWS) {
    const r = await publishModelCreditPrice({
      canonicalModelKey: row.canonicalModelKey,
      displayName: row.displayName,
      publishedBy: "seed-ecom-image-processing",
    });
    console.log(
      `[publish] ${row.canonicalModelKey} credits=${r.creditsPerUnit} listYuan=${r.listPriceYuan}`,
    );
    published++;
  }

  console.log(`[done] published=${published}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
