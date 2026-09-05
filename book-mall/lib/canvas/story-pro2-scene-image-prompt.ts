/**
 * 影视专业版 2.0 · 场景图生图 prompt 约束（运行时 + Dock）
 * canvas-web/lib/canvas/story-pro2-scene-image-prompt.ts 须保持同步
 */
import { isPro2ProductionPackSceneImagePrompt, finalizePro2SceneImageDockPrompt, isLegacyWrappedMediaPrompt } from "./pro2-production-pack-prompt";

/** 场景段 LLM 模板版本标记（用于 hub prompt 迁移） */
export const STORY_PRO2_SCENE_PROMPT_VERSION_MARKER =
  "场景图 · 广角空镜硬性约束 v4";

/** 追加到场景图 prompt 末尾 · 供 Gateway 生图模型执行 */
export const STORY_PRO2_SCENE_IMAGE_RUN_CONSTRAINTS = [
  "SCENE REFERENCE — environment establishing shot only:",
  "wide establishing shot, full environment view, landscape composition,",
  "empty scene, no people, no human figures, no characters, no faces, no portraits,",
  "no close-up, no medium shot with people, no character interaction or dialogue staging,",
  "focus on architecture, landscape, terrain, props, lighting, weather, atmosphere only.",
  "Do NOT render protagonists or crowd unless the prompt above is explicitly tagged 含人物 or 角色出镜.",
].join(" ");

export const STORY_PRO2_SCENE_IMAGE_RUN_CONSTRAINTS_ZH =
  "【场景空镜约束】广角环境建立镜头，纯空场景，无人物、无人脸、无特写人像、无中近景人物主体、无角色互动；仅表现空间/建筑/地形/光影/陈设/天气。除非上文已标注「含人物」或「角色出镜」，否则禁止出现任何人。";

const SCENE_IMAGE_CHARACTER_OPT_IN_PATTERNS: RegExp[] = [
  /含人物/,
  /角色出镜/,
  /人物出镜/,
  /【含人物】/,
  /【角色出镜】/,
  /allow\s*characters?/i,
  /with\s+(visible\s+)?characters?/i,
  /characters?\s+present/i,
  /figures?\s+in\s+scene/i,
];

const SCENE_IMAGE_CONSTRAINT_ALREADY_APPLIED = /empty scene, no people|纯环境空镜|场景空镜约束/i;

/** 剧本是否明确要求场景参考图含人物（须在生图关键词等字段标注） */
export function sceneImagePromptAllowsCharacters(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  return SCENE_IMAGE_CHARACTER_OPT_IN_PATTERNS.some((re) => re.test(t));
}

/** 为场景图 Dock / 生图 API 追加空镜约束（默认）；制作包正文或含人物标注时跳过 */
export function finalizeStoryPro2SceneImagePrompt(prompt: string): string {
  const base = prompt.trim();
  if (!base) {
    return `${STORY_PRO2_SCENE_IMAGE_RUN_CONSTRAINTS_ZH}\n${STORY_PRO2_SCENE_IMAGE_RUN_CONSTRAINTS}`;
  }
  if (
    !isLegacyWrappedMediaPrompt(base) &&
    (isPro2ProductionPackSceneImagePrompt(base) || base.includes("名称："))
  ) {
    return finalizePro2SceneImageDockPrompt(base);
  }
  if (sceneImagePromptAllowsCharacters(base)) return base;
  if (SCENE_IMAGE_CONSTRAINT_ALREADY_APPLIED.test(base)) return base;
  return `${base}\n\n${STORY_PRO2_SCENE_IMAGE_RUN_CONSTRAINTS_ZH}\n${STORY_PRO2_SCENE_IMAGE_RUN_CONSTRAINTS}`;
}
