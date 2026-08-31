import { listEcomPropLibraryEntries } from "@/lib/ecom-prop-library/catalog";
import { listEcomSceneLibraryEntries } from "@/lib/ecom-scene-library/catalog";

export type ModelShotScenePreset = {
  id: string;
  name: string;
  visualPrompt: string;
};

export type ModelShotPropPreset = {
  id: string;
  name: string;
  visualDescription: string;
};

/** 文档内置场景词库 · 用于 AI 生场景图 / 助手点选 */
export function listModelShotScenePresets(): ModelShotScenePreset[] {
  return listEcomSceneLibraryEntries().map((s) => ({
    id: s.id,
    name: s.name,
    visualPrompt: s.visualPrompt,
  }));
}

/** 文档内置道具词库 · 用于 AI 生道具图 / 助手点选 */
export function listModelShotPropPresets(): ModelShotPropPreset[] {
  return listEcomPropLibraryEntries().map((p) => ({
    id: p.id,
    name: p.name,
    visualDescription: p.visualDescription,
  }));
}

/** 文生图用：空场景、无人物 */
export function scenePresetToImagePrompt(preset: ModelShotScenePreset): string {
  return `${preset.visualPrompt}，空场景无人物，适合电商服装上身展示背景，高清摄影`;
}

/** 文生图用：单品白底 */
export function propPresetToImagePrompt(preset: ModelShotPropPreset): string {
  return `${preset.visualDescription}，${preset.name}，白底产品摄影，无人物，高清`;
}

/** 随机抽取 N 个场景 preset（助手推荐用） */
export function pickScenePresetsForAssistant(count = 5): ModelShotScenePreset[] {
  const all = listModelShotScenePresets();
  if (all.length <= count) return all;
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

/** 随机抽取 N 个道具 preset（助手推荐用） */
export function pickPropPresetsForAssistant(count = 5): ModelShotPropPreset[] {
  const all = listModelShotPropPresets();
  if (all.length <= count) return all;
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

/** 文档 Step1 · 虚拟模特推荐（模式 B） */
export type ModelShotModelArchetype = {
  id: string;
  label: string;
  description: string;
};

export const MODEL_SHOT_MODEL_ARCHETYPES: ModelShotModelArchetype[] = [
  {
    id: "model-cool",
    label: "冷感高挑御姐",
    description: "身高 175cm，黑长直发，五官立体，气场强，适合羽绒服/大衣",
  },
  {
    id: "model-sweet",
    label: "元气甜美少女",
    description: "身高 165cm，微卷中长发，圆脸，笑容治愈，适合休闲针织",
  },
  {
    id: "model-gentle",
    label: "知性温柔姐姐",
    description: "身高 170cm，锁骨发，气质温婉，适合通勤套装",
  },
];

export const MODEL_SHOT_MODEL_CHOICE_PREFIX = "模特·";
export const MODEL_SHOT_MODEL_MODE_PREFIX = "模特模式·";
export const MODEL_SHOT_SCENE_MODE_PREFIX = "场景模式·";
export const MODEL_SHOT_PROP_MODE_PREFIX = "道具模式·";

export function parseModelArchetypeChoice(choice: string): ModelShotModelArchetype | null {
  if (!choice.startsWith(MODEL_SHOT_MODEL_CHOICE_PREFIX)) return null;
  const label = choice.slice(MODEL_SHOT_MODEL_CHOICE_PREFIX.length).trim();
  return MODEL_SHOT_MODEL_ARCHETYPES.find((m) => m.label === label) ?? null;
}

export const MODEL_SHOT_SCENE_CHOICE_PREFIX = "场景·";
export const MODEL_SHOT_PROP_CHOICE_PREFIX = "道具·";

export function parseSceneChoiceLabel(choice: string): ModelShotScenePreset | null {
  if (!choice.startsWith(MODEL_SHOT_SCENE_CHOICE_PREFIX)) return null;
  const name = choice.slice(MODEL_SHOT_SCENE_CHOICE_PREFIX.length).trim();
  return listModelShotScenePresets().find((s) => s.name === name) ?? null;
}

export function parsePropChoiceLabel(choice: string): ModelShotPropPreset | null {
  if (!choice.startsWith(MODEL_SHOT_PROP_CHOICE_PREFIX)) return null;
  const name = choice.slice(MODEL_SHOT_PROP_CHOICE_PREFIX.length).trim();
  return listModelShotPropPresets().find((p) => p.name === name) ?? null;
}
