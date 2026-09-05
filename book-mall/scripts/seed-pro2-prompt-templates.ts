/**
 * Seed Pro2 platform prompt templates from TS golden constants.
 * Run: pnpm --dir book-mall seed:pro2-templates
 */
import {
  Pro2PromptTemplatePassKind,
  Pro2PromptTemplateRegistry,
} from "@prisma/client";

import {
  PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
  PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  defaultPro2ScriptCategoryDocBody,
  defaultPro2ScriptCategoryDocTitle,
} from "@/lib/canvas/pro2-script-category-doc";
import {
  pro2FixedBlock,
  pro2HubVisualStyleBlock,
  pro2VariableBlock,
} from "@/lib/canvas/pro2-prompt-template-types";
import {
  createPro2PromptTemplate,
  createPro2TemplatePack,
  listPro2PromptTemplates,
  listPro2TemplatePacks,
} from "@/lib/canvas/pro2-prompt-template-service";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_GU_FENG_CHARACTER_PROMPT,
  STORY_PRO2_GU_FENG_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_GU_FENG_SCENE_PROMPT,
  STORY_PRO2_GU_FENG_STORYBOARD_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_SCENE_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "@/lib/canvas/story-pro2-theme-outline-prompt";
import { prisma } from "@/lib/prisma";

async function upsertScriptTemplate(
  templateKey: string,
  passKind: Pro2PromptTemplatePassKind,
  name: string,
  promptBody: string,
  enabled: boolean,
): Promise<string> {
  const existing = await prisma.pro2PromptTemplate.findFirst({
    where: { templateKey, deletedAt: null },
  });
  if (existing) {
    await prisma.pro2PromptTemplate.update({
      where: { id: existing.id },
      data: {
        blocks: [pro2FixedBlock("prompt_body", "Prompt 正文", promptBody)],
        enabled,
        name,
      },
    });
    return existing.id;
  }
  const created = await createPro2PromptTemplate({
    registry: Pro2PromptTemplateRegistry.SCRIPT,
    passKind,
    templateKey,
    name,
    version: "13",
    enabled,
    blocks: [pro2FixedBlock("prompt_body", "Prompt 正文", promptBody)],
  });
  return created.id;
}

async function upsertAssetTemplate(
  templateKey: string,
  passKind: Pro2PromptTemplatePassKind,
  name: string,
  compositionSpec: string,
  variableBlocks: ReturnType<typeof pro2VariableBlock>[],
): Promise<string> {
  const blocks = [
    ...variableBlocks,
    pro2FixedBlock("composition_spec", "构图规范", compositionSpec),
    pro2HubVisualStyleBlock(),
  ];
  const existing = await prisma.pro2PromptTemplate.findFirst({
    where: { templateKey, deletedAt: null },
  });
  if (existing) {
    await prisma.pro2PromptTemplate.update({
      where: { id: existing.id },
      data: { blocks, enabled: true, name },
    });
    return existing.id;
  }
  const created = await createPro2PromptTemplate({
    registry: Pro2PromptTemplateRegistry.ASSET,
    passKind,
    templateKey,
    name,
    version: "1",
    enabled: true,
    blocks,
  });
  return created.id;
}

async function upsertPack(
  packKey: string,
  name: string,
  ids: {
    outlineTemplateId: string;
    characterTemplateId: string;
    sceneTemplateId: string;
    storyboardTemplateId: string;
  },
  categoryDoc?: { title?: string; body?: string },
): Promise<void> {
  const existing = await prisma.pro2TemplatePack.findFirst({
    where: { packKey, deletedAt: null },
  });
  if (existing) {
    await prisma.pro2TemplatePack.update({
      where: { id: existing.id },
      data: {
        ...ids,
        name,
        enabled: true,
        categoryDocTitle: categoryDoc?.title ?? null,
        categoryDocBody: categoryDoc?.body ?? null,
      },
    });
    return;
  }
  await createPro2TemplatePack({
    packKey,
    name,
    enabled: true,
    outlineTemplateId: ids.outlineTemplateId,
    characterTemplateId: ids.characterTemplateId,
    sceneTemplateId: ids.sceneTemplateId,
    storyboardTemplateId: ids.storyboardTemplateId,
    categoryDocTitle: categoryDoc?.title ?? null,
    categoryDocBody: categoryDoc?.body ?? null,
  });
}

async function main() {
  console.log("Seeding Pro2 prompt templates…");

  const defaultOutlineId = await upsertScriptTemplate(
    "script.outline.default-v13",
    "OUTLINE",
    "默认 · 大纲 full_pack v13",
    STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
    true,
  );
  const defaultCharacterId = await upsertScriptTemplate(
    "script.character.default-v13",
    "CHARACTER",
    "默认 · 角色段 v13",
    STORY_PRO2_CHARACTER_PROMPT,
    true,
  );
  const defaultSceneId = await upsertScriptTemplate(
    "script.scene.default-v13",
    "SCENE",
    "默认 · 场景段 v13",
    STORY_PRO2_SCENE_PROMPT,
    true,
  );
  const defaultStoryboardId = await upsertScriptTemplate(
    "script.storyboard.default-v13",
    "STORYBOARD",
    "默认 · 分镜段 v13",
    STORY_PRO2_STORYBOARD_PROMPT,
    true,
  );

  const guFengOutlineId = await upsertScriptTemplate(
    "script.outline.gu-feng-v13",
    "OUTLINE",
    "古风 · 大纲 full_pack v13",
    STORY_PRO2_GU_FENG_HUB_OUTLINE_FROM_THEME_PROMPT,
    false,
  );
  const guFengCharacterId = await upsertScriptTemplate(
    "script.character.gu-feng-v13",
    "CHARACTER",
    "古风 · 角色段 v13",
    STORY_PRO2_GU_FENG_CHARACTER_PROMPT,
    false,
  );
  const guFengSceneId = await upsertScriptTemplate(
    "script.scene.gu-feng-v13",
    "SCENE",
    "古风 · 场景段 v13",
    STORY_PRO2_GU_FENG_SCENE_PROMPT,
    false,
  );
  const guFengStoryboardId = await upsertScriptTemplate(
    "script.storyboard.gu-feng-v13",
    "STORYBOARD",
    "古风 · 分镜段 v13",
    STORY_PRO2_GU_FENG_STORYBOARD_PROMPT,
    false,
  );

  await upsertAssetTemplate(
    "asset.character.four-view.v1",
    "CHARACTER_FOUR_VIEW",
    "角色四视图 · 金标准",
    PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
    [
      pro2VariableBlock("name", "名称"),
      pro2VariableBlock("description", "描述"),
      pro2VariableBlock("clothing", "服装"),
      pro2VariableBlock("traits", "特征"),
    ],
  );
  await upsertAssetTemplate(
    "asset.scene.four-panorama.v1",
    "SCENE_FOUR_PANORAMA",
    "场景四全景 · 金标准",
    PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
    [
      pro2VariableBlock("name", "名称"),
      pro2VariableBlock("description", "描述"),
      pro2VariableBlock("foreground", "前背景"),
      pro2VariableBlock("atmosphere", "氛围"),
    ],
  );
  await upsertAssetTemplate(
    "asset.prop.six-view.v1",
    "PROP_SIX_VIEW",
    "道具六视图 · 金标准",
    PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
    [
      pro2VariableBlock("name", "名称"),
      pro2VariableBlock("description", "描述"),
    ],
  );

  await upsertPack(
    "default-master",
    "默认剧本大师",
    {
      outlineTemplateId: defaultOutlineId,
      characterTemplateId: defaultCharacterId,
      sceneTemplateId: defaultSceneId,
      storyboardTemplateId: defaultStoryboardId,
    },
  );

  await upsertPack(
    "gu-feng-tian-chong",
    "古风甜宠短剧剧本",
    {
      outlineTemplateId: guFengOutlineId,
      characterTemplateId: guFengCharacterId,
      sceneTemplateId: guFengSceneId,
      storyboardTemplateId: guFengStoryboardId,
    },
    {
      title: defaultPro2ScriptCategoryDocTitle("gu-feng-tian-chong"),
      body: defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong"),
    },
  );

  const templates = await listPro2PromptTemplates();
  const packs = await listPro2TemplatePacks();
  console.log(`Done: ${templates.length} templates, ${packs.length} packs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
