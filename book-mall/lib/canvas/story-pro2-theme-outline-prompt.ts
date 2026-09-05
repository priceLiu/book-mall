/**
 * 影视专业版 2.0 · 文本节点「主题 → 故事大纲」与 Hub 段 prompt
 * 规则真源：data/pro2-production-pack-standard.ts · docs/画布提示词.md
 * book-mall/lib/canvas/story-pro2-theme-outline-prompt.ts 须保持同步
 */
import {
  PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
  PRO2_CHARACTER_APPEARANCE_COLUMN_RULES,
  PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_STORYBOARD_FEW_SHOT_COMPACT,
  PRO2_UNIVERSAL_NEGATIVE,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_DIALOGUE_COLUMN_RULES,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_ONLY_MARKER,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_PARSE_CONTRACT,
  STORY_PRO2_PACK_V8_MARKER,
  STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6,
} from "./data/pro2-production-pack-standard";
import {
  PRO2_GU_FENG_CREATIVE_RULES,
} from "./data/pro2-gu-feng-tian-chong-rules";
import { PRO2_GU_FENG_VISUAL_ASSET_EXAMPLE } from "./data/pro2-gu-feng-visual-asset-example";
import {
  PRO2_GU_FENG_CHARACTER_IMAGE_RULES,
  PRO2_GU_FENG_SCENE_IMAGE_RULES,
} from "./data/pro2-gu-feng-generative-prompt-rules";
import { STORY_PRO2_SCENE_PROMPT_VERSION_MARKER } from "./story-pro2-scene-image-prompt";
import { STORY_PRO_PLANNER_SYSTEM_PREFIX } from "./story-pro-theme-templates";

/** 大纲「场景视觉辞典 · 生图关键词」与场景段共用 · 纯环境空镜约束 */
export const STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES = `- **scenes[].imagePrompt（纯环境空镜约束）**：须描述纯物理环境与气氛，供后续 **2×2 四视角场景设定图** 生图使用
- **构图**：默认远景/全景/建立镜头；❌ 禁止中景/近景/特写以人物为主体的画面
- ❌ 禁止：角色名/代词、人物动作、面部表情、人像特写
- ✅ 只允许：空间结构、建筑材质、光线、色彩、天气、静态置景
- 若剧本 **明确要求** 该场景参考图含人物，须在 imagePrompt 末尾标注 **【含人物】**；未标注则一律空镜
- 须含完整 **2×2 网格四视角**构图规范，末尾追加 \`[视觉风格：…]\``;

export const STORY_PRO2_VISUAL_STYLE_TABLE_RULES = STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6;

export { STORY_PRO2_PACK_V8_MARKER as STORY_PRO2_PACK_V6_MARKER };

export const STORY_PRO2_PACK_PROMPT_VERSION = 13;

export const STORY_PRO2_PROFESSIONAL_CHARACTER_RULES = `- **视觉锚点**：外貌关键词不超过 10 个词；服装主色须写 HEX 或固定色名，全剧不得 drift
- **description / clothing / traits**：traits **≥3 项**；**禁止**「标志性动作」
- JSON characters[] 须写 description · clothing · traits · imagePrompt（含四视图构图规范 + [视觉风格：…]）`;

export const STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES = `- **站位衔接**：每镜 sceneDescription 须标注 **【起始】…【结束】**
- **时长一致**：12–18 镜；各镜 durationSec 之和 **175–185 秒**（±5 秒）`;

export function isLegacyStoryPro2HubOutlinePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes(STORY_PRO2_JSON_ONLY_MARKER)) return true;
  if (!t.includes("JSON-only")) return true;
  if (t.includes("须输出的 GFM")) return true;
  if (t.includes("GFM 章节")) return true;
  if (t.includes("Markdown 故事大纲")) return true;
  return false;
}

export function isLegacyStoryPro2ScenePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes(STORY_PRO2_JSON_ONLY_MARKER)) return true;
  return !t.includes(STORY_PRO2_SCENE_PROMPT_VERSION_MARKER);
}

export function isLegacyStoryPro2StoryboardPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes(STORY_PRO2_JSON_ONLY_MARKER)) return true;
  if (!t.includes("12–18 镜")) return true;
  if (t.includes("GFM 表")) return true;
  return false;
}

const JSON_ONLY_TASK_HEADER = `# 任务 · JSON-only v13（${STORY_PRO2_JSON_ONLY_MARKER}）

**只输出** \`\`\`pro2-production-script\` JSON 围栏；**禁止** Markdown/GFM/说明文字。

${STORY_PRO2_PACK_PARSE_CONTRACT}

${STORY_PRO2_PACK_OUTPUT_RULES}`;

/** Pro2 脚本 Hub · Gateway system（JSON-only v13 · 非古风默认） */
export const STORY_PRO2_HUB_LLM_SYSTEM = `${STORY_PRO_PLANNER_SYSTEM_PREFIX}

输出：只输出 \`\`\`pro2-production-script\` JSON 围栏（${STORY_PRO2_JSON_ONLY_MARKER}）；禁止 Markdown/GFM/说明文字；默认全部中文（占位符/HEX/技术缩写除外）。`;

export function isLegacyPro2HubOutlineSystemPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (t.includes("GFM Markdown 制作包")) return true;
  if (t.includes("正文须为 GFM")) return true;
  if (t.includes("tier 须为 pro") && !t.includes(STORY_PRO2_JSON_ONLY_MARKER)) {
    return true;
  }
  return !t.includes(STORY_PRO2_JSON_ONLY_MARKER);
}

export const STORY_PRO2_THEME_OUTLINE_SYSTEM = `${STORY_PRO_PLANNER_SYSTEM_PREFIX}

${JSON_ONLY_TASK_HEADER}

# patch 须含（step=outline · tier=pro · schemaVersion=2）
- visualStyle（见 STORY_PRO2_VISUAL_STYLE_TABLE_RULES · 须含 HEX 与可执行摄影风格）
- coreConflict[]（至少：表层/深层冲突、人设反差、悬念钩子、情绪曲线）
- scenes[]（${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES} · ${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}）
- handoff[]（≥6 行 · ${STORY_PRO2_HANDOFF_TABLE_RULES}）
- 若信息足够，可同时输出 characters[] · props[] · shots[]（Pass1 导演表 · ${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}）

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const STORY_PRO2_THEME_OUTLINE_USER_PREFIX =
  "请根据以下故事主题或内容，生成完整故事大纲：";

/** 2.0 脚本生成器 · 单次 full_pack */
export const STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT = `${JSON_ONLY_TASK_HEADER}

# 任务：完整制作包（step=full_pack · tier=pro · schemaVersion=2 · ${STORY_PRO2_PACK_V8_MARKER}）

你将收到故事主题、梗概或上游创意参考。请 **单次输出** JSON patch，字段对齐 docs/画布提示词.md 金标准。

# patch 块与金标准（docs/画布提示词.md）
- **visualStyle** · **coreConflict[]** · **scenes[]** · **characters[]** · **props[]**（≥1）· **shots[]** · **handoff[]**（≥6）
- **characters[]**：${PRO2_CHARACTER_APPEARANCE_COLUMN_RULES}
- **characters[].imagePrompt**：${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}
- **scenes[].imagePrompt**：${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}
- **props[].imagePrompt**：${PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES}
- **shots[] Pass1**：${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}

${STORY_PRO2_THEME_OUTLINE_USER_PREFIX}`;

/** 2.0 脚本节点 · 角色段 */
export const STORY_PRO2_CHARACTER_PROMPT = `${JSON_ONLY_TASK_HEADER}

# 任务：角色视觉辞典（step=character · tier=pro · schemaVersion=2）

根据 **已连接的故事大纲** 与 visualStyle / scenes，输出 JSON patch.characters[]（3~8 项）。

${PRO2_CHARACTER_APPEARANCE_COLUMN_RULES}

${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}

${STORY_PRO2_PROFESSIONAL_CHARACTER_RULES}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

/** 2.0 脚本节点 · 场景段 */
export const STORY_PRO2_SCENE_PROMPT = `${JSON_ONLY_TASK_HEADER}

# 任务：场景视觉提示词（${STORY_PRO2_SCENE_PROMPT_VERSION_MARKER} · step=scene · tier=pro · schemaVersion=2）

根据 **已连接的故事大纲** scenes[]，补全或细化每个场景的 imagePrompt / negativePrompt。

${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}
${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}

- 每行对应大纲场景；行数须一致
- 只输出 JSON 围栏（step=scene）

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

/** 2.0 脚本节点 · 分镜段（Pass1 导演表 · v2 · 无 AI 列） */
export const STORY_PRO2_STORYBOARD_PROMPT = `${JSON_ONLY_TASK_HEADER}

# 任务：分镜脚本 Pass1 导演表（step=storyboard · tier=pro · schemaVersion=2 · ${STORY_PRO2_PACK_V8_MARKER}）

【硬性指标 · 未达标视为失败】
- 须输出 **12–18 镜**；总时长 **175–185 秒**；每镜 **10–15 秒**整数
- **禁止**只输出 1 镜概括
- JSON shots[] **禁止** imagePrompt / videoPrompt / frameImagePrompt

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

${STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES}

${STORY_PRO2_DIALOGUE_COLUMN_RULES}

${PRO2_STORYBOARD_FEW_SHOT_COMPACT}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

const STORY_PRO2_GU_FENG_APPENDIX_BASE = `
${PRO2_GU_FENG_CREATIVE_RULES}

# 映射范例
${PRO2_GU_FENG_VISUAL_ASSET_EXAMPLE}`;

const STORY_PRO2_GU_FENG_CHARACTER_APPENDIX = `
${STORY_PRO2_GU_FENG_APPENDIX_BASE}

${PRO2_GU_FENG_CHARACTER_IMAGE_RULES}

# 全剧反向提示词（角色/分镜/场景共用 · 中文顿号分隔）
${PRO2_UNIVERSAL_NEGATIVE}`;

const STORY_PRO2_GU_FENG_SCENE_APPENDIX = `
${STORY_PRO2_GU_FENG_APPENDIX_BASE}

${PRO2_GU_FENG_SCENE_IMAGE_RULES}`;

const STORY_PRO2_GU_FENG_STORYBOARD_APPENDIX = `
${STORY_PRO2_GU_FENG_APPENDIX_BASE}

# 古风 Pass1 导演表增补
- 原 BGM/音效/慢镜 → sfxNote + audioNote
- **禁止** Pass1 写 frameImagePrompt / videoPrompt；Pass2「生成提示词」完成
- 全剧反向词写入 scenes[].negativePrompt（中文顿号分隔）`;

export const STORY_PRO2_GU_FENG_HUB_OUTLINE_FROM_THEME_PROMPT =
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT + STORY_PRO2_GU_FENG_APPENDIX_BASE;

export const STORY_PRO2_GU_FENG_CHARACTER_PROMPT =
  STORY_PRO2_CHARACTER_PROMPT + STORY_PRO2_GU_FENG_CHARACTER_APPENDIX;

export const STORY_PRO2_GU_FENG_SCENE_PROMPT =
  STORY_PRO2_SCENE_PROMPT + STORY_PRO2_GU_FENG_SCENE_APPENDIX;

export const STORY_PRO2_GU_FENG_STORYBOARD_PROMPT =
  STORY_PRO2_STORYBOARD_PROMPT + STORY_PRO2_GU_FENG_STORYBOARD_APPENDIX;

export function storyPro2GuFengHubPromptPack(): {
  promptOutline: string;
  promptCharacter: string;
  promptScene: string;
  promptStoryboard: string;
} {
  return {
    promptOutline: STORY_PRO2_GU_FENG_HUB_OUTLINE_FROM_THEME_PROMPT,
    promptCharacter: STORY_PRO2_GU_FENG_CHARACTER_PROMPT,
    promptScene: STORY_PRO2_GU_FENG_SCENE_PROMPT,
    promptStoryboard: STORY_PRO2_GU_FENG_STORYBOARD_PROMPT,
  };
}

export function storyPro2HubDefaultPromptPack(): {
  promptOutline: string;
  promptCharacter: string;
  promptScene: string;
  promptStoryboard: string;
} {
  return {
    promptOutline: STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
    promptCharacter: STORY_PRO2_CHARACTER_PROMPT,
    promptScene: STORY_PRO2_SCENE_PROMPT,
    promptStoryboard: STORY_PRO2_STORYBOARD_PROMPT,
  };
}
