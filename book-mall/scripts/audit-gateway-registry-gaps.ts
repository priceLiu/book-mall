/**
 * 核查「会走 createRequestLog / assertModelRegistered」的 modelKey
 * 是否均已在 GatewayModelRoute 注册（注册表非空时未登记即 500，同试衣 aitryon 问题）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/audit-gateway-registry-gaps.ts
 */
import { CANVAS_BUILTIN_MODELS } from "../lib/canvas/canvas-constants";
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";
import { STORY_DEFAULT_PRIMARY_MODEL_KEYS } from "../lib/story/story-constants";
import { FITTING_ROOM_AI_FIT_DEFAULT_SCHEME_A_MODEL_KEY } from "../lib/tool-billable-price";
import { prisma } from "../lib/prisma";

/** 代码/价目里常见、但未必在 canonical-registry 的 modelKey */
const EXTRA_INVOKE_MODEL_KEYS = [
  "wanx2.1-t2i-plus",
  "wanx2.1-t2i-turbo",
  "qwen3-tts-flash",
  "qwen3-tts",
  "hy-3d-express",
  "hunyuan-3d-express",
  "doubao-seedance-2.0",
  "happyhorse-1.0-i2v",
  "happyhorse-1.0-t2v",
  "happyhorse-1.0-video-edit",
  "wan2.6-i2v",
  "wan2.6-t2v",
  "wan2.6-i2v-flash",
  "wan2.6-r2v-flash",
  "wan2.7-i2v-2026-04-25",
  "wan2.7-t2v",
  "wan2.7-t2v-2026-04-25",
  "wan2.5-i2v-preview",
  "wan2.5-t2v-preview",
  "pixverse-c1-it2v",
  "pixverse-c1-t2v",
  "pixverse-v6-it2v",
  "pixverse-v6-t2v",
  "qwen-vl-max",
  "qwen-vl-plus",
  "qwen3-vl-plus",
  "qwen3-vl-flash",
  "qwen3.7-plus",
  "qwen3.5-plus",
  "qwen3.5-flash",
  "qwen3.5-27b",
  "qwen3.6-plus",
  "qwen3.6-flash",
  "seedream-5-lite",
  "seedream-4.5",
  "flux-2-pro",
  "gpt-image-2",
  "gpt-image-2-text-to-image",
  "gpt-image-2-image-to-image",
  "grok-imagine/text-to-image",
  "grok-imagine/image-to-video",
  "grok-imagine-video-1-5-preview",
  "wan/2-6-video-to-video",
  "kling-2.6/motion-control",
  "kling-3.0/motion-control",
  "topaz/video-upscale",
  "gpt-image-1",
  "qwen-text-to-image",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "google/gemini-3-flash-preview",
  "gemini-3-flash",
  "gemini-2.5-flash",
];

/** 仅收集会作为 createTask model 参数提交的 vendor modelKey（非 canonical 别名）。 */
function collectInvokeModelKeys(): Set<string> {
  const keys = new Set<string>([
    ...EXTRA_INVOKE_MODEL_KEYS,
    ...CANVAS_BUILTIN_MODELS.map((m) => m.modelKey),
    ...Object.values(STORY_DEFAULT_PRIMARY_MODEL_KEYS),
    FITTING_ROOM_AI_FIT_DEFAULT_SCHEME_A_MODEL_KEY,
  ]);
  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    for (const r of def.routes) keys.add(r.modelKey);
  }
  return keys;
}

async function main() {
  const registryCount = await prisma.gatewayModelRoute.count({ where: { active: true } });
  console.log(`GatewayModelRoute 活跃路由数: ${registryCount}`);
  if (registryCount === 0) {
    console.log("注册表为空，createRequestLog 走 model-router 兜底，跳过缺口核查。");
    return;
  }

  const registered = new Set(
    (
      await prisma.gatewayModelRoute.findMany({
        where: { active: true, catalog: { gatewayPublished: true, active: true } },
        select: { modelKey: true },
      })
    ).map((r) => r.modelKey),
  );

  const creditPrices = await prisma.modelCreditPrice.findMany({
    where: { active: true },
    select: { canonicalModelKey: true },
  });

  const recentLogs = await prisma.gatewayRequestLog.findMany({
    where: { submittedAt: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
    select: { model: true },
    distinct: ["model"],
    take: 200,
  });

  const candidates = new Set<string>([
    ...collectInvokeModelKeys(),
    ...recentLogs.map((l) => l.model).filter(Boolean),
  ]);

  const missing: Array<{ modelKey: string; sources: string[] }> = [];

  for (const key of [...candidates].sort()) {
    if (registered.has(key)) continue;
    const sources: string[] = [];
    if (GATEWAY_CANONICAL_REGISTRY.some((d) => d.routes.some((r) => r.modelKey === key))) {
      sources.push("canonical-registry-route");
    }
    if (CANVAS_BUILTIN_MODELS.some((m) => m.modelKey === key)) sources.push("canvas-builtin");
    if (Object.values(STORY_DEFAULT_PRIMARY_MODEL_KEYS).includes(key)) sources.push("story-default");
    if (EXTRA_INVOKE_MODEL_KEYS.includes(key)) sources.push("extra-invoke");
    if (creditPrices.some((b) => b.canonicalModelKey === key)) sources.push("ModelCreditPrice");
    if (recentLogs.some((l) => l.model === key)) sources.push("GatewayRequestLog(90d)");
    missing.push({ modelKey: key, sources });
  }

  if (missing.length === 0) {
    console.log("✓ 候选 modelKey 均已注册 GatewayModelRoute。");
  } else {
    console.error(`\n✗ 未注册 GatewayModelRoute 的 modelKey（${missing.length} 个）：\n`);
    for (const row of missing) {
      console.error(`  - ${row.modelKey}`);
      console.error(`      来源: ${row.sources.join(" · ")}`);
    }
    console.error(
      "\n修复：补入 lib/platform-model/canonical-registry.ts + 迁移 SQL，或执行 pnpm gateway:seed-registry --confirm",
    );
    process.exit(1);
  }

  const sbv1Canonicals = [
    "seedance-2.0-720p-real",
    "seedance-2.0-1080p-real",
    "seedance-2.0-fast-720p-real",
    "seedance-pro-1080p",
  ];
  const publishedPrices = new Set(
    (
      await prisma.modelCreditPrice.findMany({
        where: { active: true, canonicalModelKey: { in: sbv1Canonicals } },
        select: { canonicalModelKey: true },
      })
    ).map((p) => p.canonicalModelKey),
  );
  const missingPrices = sbv1Canonicals.filter((k) => !publishedPrices.has(k));
  if (missingPrices.length > 0) {
    console.error(`\n✗ sbv1 视频分档未发布 ModelCreditPrice（${missingPrices.length}）：`);
    for (const k of missingPrices) console.error(`  - ${k}`);
    console.error("\n修复：pnpm seed:sbv1-video-credits 或在 /admin/model-credit-ledger 发布");
    process.exit(1);
  }
  console.log("✓ sbv1 视频分档均已发布 ModelCreditPrice。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
