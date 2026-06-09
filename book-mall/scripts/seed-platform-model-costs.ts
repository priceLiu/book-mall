/**
 * 补充 KIE / 火山等 ModelCostProfile，并触发平台模型自动上架。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts
 *
 * KIE 参考价：https://kie.ai/pricing（2026-06）
 */
import { autoPublishPlatformOfferings } from "../lib/platform-model/auto-publish-offerings";
import { prisma } from "../lib/prisma";

type CostSeed = {
  canonicalModelKey: string;
  vendor: string;
  unit: "PER_KTOKEN" | "PER_IMAGE" | "PER_SEC";
  tierRaw?: string;
  listCostYuan: number;
  discountRate: number;
};

/** KIE + 火山 + 补充 Aliyun/DeepSeek 成本档 */
const EXTRA_COSTS: CostSeed[] = [
  // LLM
  {
    canonicalModelKey: "qwen-turbo",
    vendor: "aliyun",
    unit: "PER_KTOKEN",
    listCostYuan: 0.002,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "deepseek-chat",
    vendor: "deepseek",
    unit: "PER_KTOKEN",
    listCostYuan: 0.001,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "gemini-flash",
    vendor: "kie",
    unit: "PER_KTOKEN",
    listCostYuan: 0.0015,
    discountRate: 0.05,
  },
  // KIE 生图
  {
    canonicalModelKey: "lib-nano-pro",
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "1K",
    listCostYuan: 0.04,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "lib-nano-pro",
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "2K",
    listCostYuan: 0.06,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "lib-nano-pro",
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "4K",
    listCostYuan: 0.12,
    discountRate: 0.05,
  },
  // 文生图（Gateway 统一 canonical）
  {
    canonicalModelKey: "wan2.7-image",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.08,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wan2.7-image-pro",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.12,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "kling-3.0-image",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.1,
    discountRate: 0.1,
  },
  // 图生视频
  {
    canonicalModelKey: "seedance-2.0",
    vendor: "volcengine",
    unit: "PER_SEC",
    tierRaw: "720p",
    listCostYuan: 0.18,
    discountRate: 0.08,
  },
  {
    canonicalModelKey: "seedance-2.0",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "720p",
    listCostYuan: 0.125,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "wanxiang-video-2.7-i2v",
    vendor: "aliyun",
    unit: "PER_SEC",
    listCostYuan: 0.2,
    discountRate: 0.1,
  },
  // KIE 视频
  {
    canonicalModelKey: "kling-3.0-video",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "标准",
    listCostYuan: 0.68,
    discountRate: 0.05,
  },
  // 百炼 R2V / 万相
  {
    canonicalModelKey: "happyhorse-r2v",
    vendor: "aliyun",
    unit: "PER_SEC",
    listCostYuan: 0.22,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wanxiang-video-2.7",
    vendor: "aliyun",
    unit: "PER_SEC",
    listCostYuan: 0.25,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wanxiang-video-2.6",
    vendor: "aliyun",
    unit: "PER_SEC",
    listCostYuan: 0.22,
    discountRate: 0.1,
  },
];

function seedId(row: CostSeed): string {
  const tier = row.tierRaw ? `_${row.tierRaw.replace(/\W/g, "")}` : "";
  return `seed_${row.canonicalModelKey}_${row.vendor}${tier}`;
}

async function upsertCost(row: CostSeed) {
  const netCostYuan = row.listCostYuan * (1 - row.discountRate);
  const id = seedId(row);
  await prisma.modelCostProfile.upsert({
    where: { id },
    create: {
      id,
      canonicalModelKey: row.canonicalModelKey,
      vendor: row.vendor,
      unit: row.unit,
      tierRaw: row.tierRaw ?? null,
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      netCostYuan,
      active: true,
      note: "seed-platform-model-costs (kie.ai/pricing)",
    },
    update: {
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      netCostYuan,
      active: true,
      note: "seed-platform-model-costs (kie.ai/pricing)",
    },
  });
  console.log(`[ok] ${row.canonicalModelKey} (${row.vendor}${row.tierRaw ? ` · ${row.tierRaw}` : ""})`);
}

async function main() {
  for (const row of EXTRA_COSTS) {
    await upsertCost(row);
  }

  const result = await autoPublishPlatformOfferings({ publishedBy: "seed-script" });
  console.log(`[ok] auto-publish: ${result.published} active, ${result.skipped} skipped`);
  if (result.warnings.length) {
    console.warn(result.warnings.join("\n"));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
