/**
 * 补充 KIE / 火山等 ModelCostProfile，并触发平台模型自动上架。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts
 *   pnpm exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts --no-publish
 *
 * KIE 参考价：https://kie.ai/pricing（2026-08）
 */
import { MISSING_MODEL_COST_SEEDS } from "../lib/finance/missing-model-cost-seeds";
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
  // KIE 生图 · nano-banana-pro 按清晰度分档（Gateway 路由仍用 lib-nano-pro）
  {
    canonicalModelKey: "lib-nano-pro-1k",
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "1K",
    listCostYuan: 0.04,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "lib-nano-pro-2k",
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "2K",
    listCostYuan: 0.06,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "lib-nano-pro-4k",
    vendor: "kie",
    unit: "PER_IMAGE",
    tierRaw: "4K",
    listCostYuan: 0.12,
    discountRate: 0.05,
  },
  // 文生图（百炼华北2 官方价：help.aliyun.com/zh/model-studio/model-pricing）
  {
    canonicalModelKey: "wan2.7-image",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.2,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wan2.6-image",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.2,
    discountRate: 0.1,
    note: "万相 2.6 图像编辑 · 官方 0.20 元/张",
  },
  {
    canonicalModelKey: "wan2.7-image-pro",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.5,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "qwen-image-3.0-pro",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.5,
    discountRate: 0.1,
    note: "2K 输出档 · 官方 0.5 元/张",
  },
  {
    canonicalModelKey: "z-image-turbo",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.1,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "kling-3.0-image",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    tierRaw: "1K",
    listCostYuan: 0.2,
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
    tierRaw: "720P",
    listCostYuan: 0.6,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "kling-3.0-video",
    vendor: "aliyun",
    unit: "PER_SEC",
    tierRaw: "720P",
    listCostYuan: 0.6,
    discountRate: 0.1,
  },
  // KIE 生图 · gpt-image-1.5 / gpt-image-2 / Grok Imagine
  {
    canonicalModelKey: "gpt-image-1",
    vendor: "kie",
    unit: "PER_IMAGE",
    listCostYuan: 0.14,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "gpt-image-2",
    vendor: "kie",
    unit: "PER_IMAGE",
    listCostYuan: 0.25,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "grok-imagine/text-to-image",
    vendor: "kie",
    unit: "PER_IMAGE",
    listCostYuan: 0.14,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "grok-imagine/image-to-video",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "720p",
    listCostYuan: 0.35,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "grok-imagine-video-1-5-preview",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "480p",
    listCostYuan: 0.56,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "grok-imagine-video-1-5-preview",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "720p",
    listCostYuan: 0.98,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "wan/2-6-video-to-video",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "1080p",
    listCostYuan: 0.22,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "kling-2.6/motion-control",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "720p",
    listCostYuan: 0.45,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "kling-3.0/motion-control",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "1080p",
    listCostYuan: 0.85,
    discountRate: 0.05,
  },
  {
    canonicalModelKey: "topaz/video-upscale",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "2x",
    listCostYuan: 0.15,
    discountRate: 0.05,
  },
  // KIE 视频
  {
    canonicalModelKey: "kling-3.0-video",
    vendor: "kie",
    unit: "PER_SEC",
    tierRaw: "720P",
    listCostYuan: 0.49,
    discountRate: 0.05,
  },
  // 百炼 R2V / 万相
  {
    canonicalModelKey: "happyhorse-r2v",
    vendor: "aliyun",
    unit: "PER_SEC",
    tierRaw: "标准",
    listCostYuan: 0.9,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wanxiang-video-2.7",
    vendor: "aliyun",
    unit: "PER_SEC",
    tierRaw: "720P",
    listCostYuan: 0.6,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "wanxiang-video-2.6",
    vendor: "aliyun",
    unit: "PER_SEC",
    tierRaw: "720P",
    listCostYuan: 0.6,
    discountRate: 0.1,
  },
  // AI 试衣（文生图 taxonomy）
  {
    canonicalModelKey: "aitryon",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.2,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "aitryon-plus",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.5,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "aitryon-parsing-v1",
    vendor: "aliyun",
    unit: "PER_IMAGE",
    listCostYuan: 0.004,
    discountRate: 0.1,
  },
  // 视频理解 / 视觉实验室 VL
  {
    canonicalModelKey: "qwen3-vl-plus",
    vendor: "aliyun",
    unit: "PER_KTOKEN",
    listCostYuan: 0.005,
    discountRate: 0.1,
  },
  {
    canonicalModelKey: "qwen3-vl-flash",
    vendor: "aliyun",
    unit: "PER_KTOKEN",
    listCostYuan: 0.0015,
    discountRate: 0.1,
  },
  // TTS / 语音
  {
    canonicalModelKey: "qwen3-tts-flash",
    vendor: "aliyun",
    unit: "PER_KTOKEN",
    listCostYuan: 0.008,
    discountRate: 0.1,
  },
  ...MISSING_MODEL_COST_SEEDS,
];

const ALL_COSTS: CostSeed[] = EXTRA_COSTS;

function seedId(row: CostSeed): string {
  const tier = row.tierRaw ? `_${row.tierRaw.replace(/\W/g, "")}` : "";
  return `seed_${row.canonicalModelKey}_${row.vendor}${tier}`;
}

/** 同 canonical + vendor 只保留本次 seed 档，避免旧手工档净成本更低导致误发布。 */
async function deactivateSupersededCosts(row: CostSeed) {
  const keepId = seedId(row);
  const r = await prisma.modelCostProfile.updateMany({
    where: {
      canonicalModelKey: row.canonicalModelKey,
      vendor: row.vendor,
      id: { not: keepId },
      active: true,
    },
    data: {
      active: false,
      note: "superseded by seed-platform-model-costs",
    },
  });
  if (r.count > 0) {
    console.log(
      `[deactivate] ${row.canonicalModelKey} (${row.vendor}): ${r.count} legacy profile(s)`,
    );
  }
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
  await deactivateSupersededCosts(row);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const skipPublish = process.argv.includes("--no-publish");

  for (const row of ALL_COSTS) {
    await upsertCost(row);
  }
  console.log(`[ok] upserted ${ALL_COSTS.length} cost profile(s)`);

  if (skipPublish) {
    console.log("[skip] auto-publish (--no-publish)");
    return;
  }

  const seededKeys = [...new Set(ALL_COSTS.map((r) => r.canonicalModelKey))];
  let published = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const batch of chunk(seededKeys, 15)) {
    const result = await autoPublishPlatformOfferings({
      canonicalKeys: batch,
      publishedBy: "seed-script",
    });
    published += result.published;
    skipped += result.skipped;
    warnings.push(...result.warnings);
  }

  console.log(`[ok] auto-publish: ${published} active, ${skipped} skipped`);
  if (warnings.length) {
    console.warn(warnings.slice(0, 20).join("\n"));
    if (warnings.length > 20) console.warn(`… 另有 ${warnings.length - 20} 条警告`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
