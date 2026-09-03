/**
 * 发布视频理解新模型的成本档 + 积分价 + AppModelOffering（平台代付可见前提）。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/publish-video-understanding-models.ts
 */
import { autoPublishPlatformOfferings } from "../lib/platform-model/auto-publish-offerings";
import { invalidateGatewayModelListCache } from "../lib/gateway/model-list-cache";
import { listModelsForApp } from "../lib/gateway/model-registry";
import {
  importModelCostProfileVersioned,
} from "../lib/pricing/import-model-cost-profile-versioned";
import { ktokenFromMillion } from "../lib/finance/missing-model-cost-seeds";
import { isStoryLlmVisionModel } from "../lib/canvas/story-llm-vision-models";
import { prisma } from "../lib/prisma";

const ALI = 0.1;

const VIDEO_UNDERSTANDING_PUBLISH = [
  {
    canonicalModelKey: "qwen3-omni-flash",
    listCostYuan: ktokenFromMillion(1.8),
    inputListCostYuan: ktokenFromMillion(1.8),
    outputListCostYuan: ktokenFromMillion(15.8),
    note: "百炼 qwen3-omni-flash · 输入 1.8/M · 输出 15.8/M",
  },
  {
    canonicalModelKey: "qwen2.5-vl-72b-instruct",
    listCostYuan: ktokenFromMillion(16),
    inputListCostYuan: ktokenFromMillion(16),
    outputListCostYuan: ktokenFromMillion(48),
    note: "百炼 qwen2.5-vl-72b-instruct · 输入 16/M · 输出 48/M",
  },
  {
    canonicalModelKey: "glm-5.3-flash",
    listCostYuan: ktokenFromMillion(0.8),
    inputListCostYuan: ktokenFromMillion(0.8),
    outputListCostYuan: ktokenFromMillion(2.8),
    note: "百炼 ZHIPU/GLM-5.3-Flash · 输入 0.8/M · 输出 2.8/M",
  },
] as const;

async function main() {
  for (const row of VIDEO_UNDERSTANDING_PUBLISH) {
    const result = await importModelCostProfileVersioned({
      canonicalModelKey: row.canonicalModelKey,
      vendor: "aliyun",
      unit: "PER_KTOKEN",
      listCostYuan: row.listCostYuan,
      inputListCostYuan: row.inputListCostYuan,
      outputListCostYuan: row.outputListCostYuan,
      discountRate: ALI,
      note: row.note,
      seedId: `seed_${row.canonicalModelKey}_video_understanding`,
    });
    console.log(`[cost] ${row.canonicalModelKey} → ${result.action}`);
  }

  const pub = await autoPublishPlatformOfferings({
    canonicalKeys: VIDEO_UNDERSTANDING_PUBLISH.map((r) => r.canonicalModelKey),
    publishedBy: "publish-video-understanding-models",
  });
  console.log("[publish]", pub);

  invalidateGatewayModelListCache();

  const ecomLlm = await listModelsForApp({
    appTag: "ecom",
    role: "LLM",
    persona: "PLATFORM_CREDIT",
    boundKinds: [],
  });
  const canvasLlm = await listModelsForApp({
    appTag: "canvas",
    role: "LLM",
    sceneKey: "pro2-llm",
    persona: "PLATFORM_CREDIT",
    boundKinds: [],
  });

  const visionEcom = ecomLlm.filter((m) => isStoryLlmVisionModel(m.modelKey));
  console.log("\n[ecom vision LLM]", visionEcom.map((m) => m.modelKey).join(", "));
  console.log("[canvas pro2-llm includes new models]", {
    omni: canvasLlm.some((m) => m.modelKey === "qwen3-omni-flash"),
    vl72: canvasLlm.some((m) => m.modelKey === "qwen2.5-vl-72b-instruct"),
    glm: canvasLlm.some((m) => m.modelKey === "glm-5.3-flash"),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
