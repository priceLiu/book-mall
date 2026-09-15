/**
 * 种子六类场景模板 + 从 model-ops-seed-config 映射绑定 + 发布静态目录。
 *
 *   pnpm gateway:seed-scene-templates
 *   pnpm gateway:seed-scene-templates:skip-gate
 *   pnpm gateway:seed-scene-templates -- --no-publish
 */
import {
  CANVAS_SCENE_MODEL_KEYS,
  ECOM_SCENE_MODEL_KEYS,
  QUICK_REPLICA_SCENE_MODEL_KEYS,
} from "../lib/platform-model/model-ops-seed-config";
import {
  bindCanonicalToTemplate,
  ensureDefaultSceneTemplates,
  publishModelTemplateCatalog,
  resolveCanonicalFromModelKey,
  type SceneTemplateId,
} from "../lib/platform-model/scene-templates";
import { prisma } from "../lib/prisma";

const SKIP_GATE = process.argv.includes("--skip-gate");
const NO_PUBLISH = process.argv.includes("--no-publish");

/** sceneKey → 场景模板（一对多） */
const SCENE_TO_TEMPLATES: Record<string, SceneTemplateId[]> = {
  "pro2-llm": ["text"],
  "pro2-image": ["t2i", "i2i"],
  "pro2-video": ["i2v", "t2v"],
  "sbv1-image": ["t2i", "i2i"],
  "sbv1-video": ["i2v", "t2v"],
  "qr-t2i": ["t2i"],
  "qr-t2v": ["t2v", "i2v"],
  "ecom-storyboard-image": ["t2i", "i2i"],
  "ecom-image-processing": ["i2i"],
  "ecom-storyboard-chat": ["text"],
  "ecom-storyboard-video": ["i2v", "t2v"],
  "ecom-model-shot-chat": ["text"],
  "ecom-model-shot-image": ["t2i", "i2i"],
  "ecom-media-decompose-chat": ["text"],
  "ecom-film-pull-chat": ["text"],
  "ecom-outfit-video": ["v2v", "i2v"],
};

async function main() {
  await ensureDefaultSceneTemplates();
  console.log("[scene-templates] 已确保六类模板");

  const pending: Array<{ modelKey: string; templates: SceneTemplateId[] }> = [];
  const groups: Array<{ sceneKey: string; keys: readonly string[] }> = [
    ...Object.entries(CANVAS_SCENE_MODEL_KEYS).map(([sceneKey, keys]) => ({
      sceneKey,
      keys: keys as readonly string[],
    })),
    ...Object.entries(QUICK_REPLICA_SCENE_MODEL_KEYS).map(([sceneKey, keys]) => ({
      sceneKey,
      keys: keys as readonly string[],
    })),
    ...Object.entries(ECOM_SCENE_MODEL_KEYS).map(([sceneKey, keys]) => ({
      sceneKey,
      keys: keys as readonly string[],
    })),
  ];

  for (const g of groups) {
    const templates = SCENE_TO_TEMPLATES[g.sceneKey];
    if (!templates?.length) continue;
    for (const modelKey of g.keys) {
      pending.push({ modelKey, templates: [...templates] });
    }
  }

  let bound = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const item of pending) {
    const canonical = await resolveCanonicalFromModelKey(item.modelKey);
    if (!canonical) {
      skipped += 1;
      continue;
    }
    for (const templateId of item.templates) {
      const dedupe = `${templateId}|${canonical}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const r = await bindCanonicalToTemplate({
        templateId,
        canonicalModelKey: canonical,
        skipGate: SKIP_GATE,
      });
      if (r.ok) {
        bound += 1;
      } else {
        skipped += 1;
        if (skipped <= 15) {
          console.log(`  skip ${templateId}/${canonical}: ${r.error}`);
        }
      }
    }
  }

  console.log(
    `[scene-templates] 绑定成功 ${bound} · 跳过 ${skipped}${SKIP_GATE ? " (--skip-gate)" : ""}`,
  );

  if (!NO_PUBLISH) {
    const pub = await publishModelTemplateCatalog({
      publishedBy: "seed-scene-templates",
    });
    console.log(`[scene-templates] 已发布 version=${pub.version} · models=${pub.modelCount}`);
  } else {
    console.log("[scene-templates] --no-publish 跳过发布");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
