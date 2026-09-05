import { prisma } from "../lib/prisma";
import { listModelsForApp } from "../lib/gateway/model-registry";
import { invalidateGatewayModelListCache } from "../lib/gateway/model-list-cache";

const KEYS = [
  "qwen3-omni-flash",
  "qwen2.5-vl-72b-instruct",
  "glm-5.3-flash",
  "qwen3.8-max",
];

async function main() {
  invalidateGatewayModelListCache();
  for (const k of KEYS) {
    const [catalog, price, offering, shelf] = await Promise.all([
      prisma.modelCatalog.findFirst({
        where: { canonicalKey: k },
        select: { active: true, gatewayPublished: true, appTags: true },
      }),
      prisma.modelCreditPrice.findFirst({
        where: { canonicalModelKey: k, active: true },
        select: { creditsPerUnit: true },
      }),
      prisma.appModelOffering.findFirst({
        where: { canonicalModelKey: k },
        select: { status: true },
      }),
      prisma.appModelShelf.count({
        where: { canonicalModelKey: k, appTag: "ecom", status: "ACTIVE" },
      }),
    ]);
    console.log(k, { catalog, price, offering, shelfCount: shelf });
  }

  const ecomLlm = await listModelsForApp({
    appTag: "ecom",
    sceneKey: "ecom-media-decompose-chat",
    role: "LLM",
    persona: "PLATFORM_CREDIT",
    boundKinds: [],
  });
  const keys = ecomLlm.map((m) => m.modelKey);
  console.log("\necom LLM platform keys include new models:", {
    omni: keys.includes("qwen3-omni-flash"),
    vl72: keys.includes("qwen2.5-vl-72b-instruct"),
    glm: keys.includes("glm-5.3-flash"),
    total: keys.length,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
