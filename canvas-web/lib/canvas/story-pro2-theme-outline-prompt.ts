/**
 * 影视专业版 2.0 · 文本节点「主题 → 故事大纲」与 Hub 段 prompt
 * 规则真源：data/pro2-production-pack-standard.ts · docs/大模型剧本提示词.md
 * book-mall/lib/canvas/story-pro2-theme-outline-prompt.ts 须保持同步
 */
import {
  PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
  PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_STORYBOARD_FEW_SHOT_COMPACT,
  PRO2_UNIVERSAL_NEGATIVE,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_V8_MARKER,
  STORY_PRO2_PROP_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6,
} from "./data/pro2-production-pack-standard";
import {
  PRO2_GU_FENG_CREATIVE_RULES,
  PRO2_GU_FENG_GFM_OUTPUT_RULES,
} from "./data/pro2-gu-feng-tian-chong-rules";
import { PRO2_GU_FENG_VISUAL_ASSET_EXAMPLE } from "./data/pro2-gu-feng-visual-asset-example";
import {
  PRO2_GU_FENG_CHARACTER_IMAGE_RULES,
  PRO2_GU_FENG_SCENE_IMAGE_RULES,
} from "./data/pro2-gu-feng-generative-prompt-rules";
import { STORY_PRO2_SCENE_PROMPT_VERSION_MARKER } from "./story-pro2-scene-image-prompt";
import { STORY_PRO_PLANNER_SYSTEM_PREFIX } from "./story-pro-theme-templates";

/** 大纲「场景视觉辞典 · 生图关键词」与场景段共用 · 纯环境空镜约束 */
export const STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES = `- **生图关键词（纯环境空镜约束）**：须描述纯物理环境与气氛，供后续 **2×2 四视角场景设定图** 生图使用
- **构图**：默认远景/全景/建立镜头；❌ 禁止中景/近景/特写以人物为主体的画面
- ❌ 禁止：角色名/代词、人物动作、面部表情、人像特写
- ✅ 只允许：空间结构、建筑材质、光线、色彩、天气、静态置景
- 若剧本 **明确要求** 该场景参考图含人物，须在生图关键词末尾标注 **【含人物】**；未标注则一律空镜
- 须含完整 **2×2 网格四视角**构图规范，末尾追加 \`[视觉风格：…]\``;

export const STORY_PRO2_VISUAL_STYLE_TABLE_RULES = STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6;

export { STORY_PRO2_PACK_V8_MARKER as STORY_PRO2_PACK_V6_MARKER };

export const STORY_PRO2_PACK_PROMPT_VERSION = 11;

export const STORY_PRO2_PROFESSIONAL_CHARACTER_RULES = `- **视觉锚点**：外貌关键词不超过 10 个词；服装主色须写 HEX 或固定色名，全剧不得 drift
- **AI生图提示词(英文)** 列内写 **中文** 四视图构图规范 + \`[视觉风格：…]\``;

export const STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES = `- **站位衔接**：每镜「画面描述」须标注 **【起始】…【结束】**
- **时长一致**：12–18 镜；各镜 \`时长(秒)\` 之和 **175–185 秒**（±5 秒）`;

export function isLegacyStoryPro2HubOutlinePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes(STORY_PRO2_PACK_V8_MARKER)) return true;
  if (!t.includes("道具视觉辞典")) return true;
  if (!t.includes("pro2-production-script")) return true;
  if (t.includes("不要 JSON")) return true;
  return false;
}

export function isLegacyStoryPro2ScenePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  return !t.includes(STORY_PRO2_SCENE_PROMPT_VERSION_MARKER);
}

export function isLegacyStoryPro2StoryboardPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes(STORY_PRO2_PACK_V8_MARKER)) return true;
  if (!t.includes("12–18 镜")) return true;
  if (!t.includes("Pass1 禁止")) return true;
  if (!t.includes("禁止照抄示例剧名")) return true;
  return false;
}

export const STORY_PRO2_THEME_OUTLINE_SYSTEM = `${STORY_PRO_PLANNER_SYSTEM_PREFIX}

用户将提供故事主题、梗概或若干场景描述。请输出 **Markdown 故事大纲 / 制作包前段**（GFM 章节 + 末尾 JSON 围栏）。

${STORY_PRO2_PACK_OUTPUT_RULES}

# 必须包含的章节（## 标题字面一致 · ${STORY_PRO2_PACK_V8_MARKER}）

## 视觉风格总纲
${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}

## 场景视觉辞典
GFM 表，表头不可改：

${STORY_PRO2_SCENE_TABLE_HEADER}

${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}
${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}

## 核心冲突与结构摘要
${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}

## 下一步交接清单
${STORY_PRO2_HANDOFF_TABLE_RULES}

# 约束
- ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}
- 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（step=outline · tier=pro）
- 若信息足够，可同时输出 ## 角色视觉辞典 · ## 道具视觉辞典 · ## 分镜脚本（10 列 Pass1），不得留空表

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const STORY_PRO2_THEME_OUTLINE_USER_PREFIX =
  "请根据以下故事主题或内容，生成完整故事大纲：";

/** 2.0 脚本生成器 · 单次 full_pack */
export const STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT = `# 任务：故事剧本 · 完整制作包（full_pack · ${STORY_PRO2_PACK_V8_MARKER}）

你将收到故事主题、梗概或上游创意参考。请 **单次输出完整制作包**，并在 **末尾** 附 \`\`\`pro2-production-script\` JSON 围栏（**step=full_pack** · tier=pro · schemaVersion=2）。

${STORY_PRO2_PACK_OUTPUT_RULES}

# 须输出的 GFM 章节（与 JSON patch 字段一致）
## 视觉风格总纲
${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}
## 场景视觉辞典
${STORY_PRO2_SCENE_TABLE_HEADER}
${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}
${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}
## 核心冲突与结构摘要
${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}
## 角色视觉辞典
${STORY_PRO2_PROFESSIONAL_CHARACTER_RULES}
${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}
## 道具视觉辞典
${STORY_PRO2_PROP_TABLE_HEADER}
${PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES}
## 分镜脚本
${STORY_PRO2_STORYBOARD_TABLE_HEADER}
${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}
${STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES}
## 下一步交接清单
${STORY_PRO2_HANDOFF_TABLE_RULES}

- JSON patch 须含 meta · visualStyle · coreConflict · scenes · characters · **props** · shots · handoff

${STORY_PRO2_JSON_OUTPUT_CONTRACT}

${STORY_PRO2_THEME_OUTLINE_USER_PREFIX}`;

/** 2.0 脚本节点 · 角色段 */
export const STORY_PRO2_CHARACTER_PROMPT = `# 任务：角色视觉辞典（${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据 **已连接的故事大纲** 与已生成「视觉风格总纲 / 场景辞典」，输出 **## 角色视觉辞典** 段。

${STORY_PRO2_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 角色视觉辞典

| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |
|------|------|----------------------|------|---------------------|

${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}

- **必须**输出上表；每行一个主要角色（3~8 行）
- **AI生图提示词(英文)** 列须含 **四视图构图规范** + \`[视觉风格：…]\`
- 只输出「## 角色视觉辞典」+ 一张表，并附末尾 JSON 围栏（step=character）

${STORY_PRO2_PROFESSIONAL_CHARACTER_RULES}`;

/** 2.0 脚本节点 · 场景段 */
export const STORY_PRO2_SCENE_PROMPT = `# 任务：场景视觉提示词（${STORY_PRO2_SCENE_PROMPT_VERSION_MARKER} · ${STORY_PRO2_PACK_V8_MARKER}）

根据 **已连接的故事大纲** 中的「场景视觉辞典」，为每个场景生成可直接用于 AI 生图的 **中文** 提示词。

${STORY_PRO2_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 场景视觉提示词

| 场景名 | 环境 | 时间 | 气氛 | 场景描述 | AI生图提示词(英文) |
|------|------|------|------|----------|---------------------|

${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}
${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}

- 每行对应大纲场景辞典中的一行；行数须一致
- 只输出「## 场景视觉提示词」+ 一张表，并附末尾 JSON 围栏（step=scene）`;

/** 2.0 脚本节点 · 分镜段（Pass1 导演表 · v2 · 无 AI 列） */
export const STORY_PRO2_STORYBOARD_PROMPT = `# 任务：分镜脚本表（Pass1 导演表 · ${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

【硬性指标 · 未达标视为失败】
- 须输出 **12–18 镜**完整序列；总时长 **175–185 秒**；每镜 **10–15 秒**整数
- **禁止**只输出 1 镜概括、禁止「镜数规划/总时长」小表代替分镜表
- 只输出 **## 分镜脚本** + **一张** 10 列 GFM 表，并附末尾 JSON 围栏（step=storyboard · schemaVersion=2）
- **Pass1 禁止** AI生图/AI视频 列；**禁止** JSON shots[] 含 imagePrompt / videoPrompt / frameImagePrompt

${STORY_PRO2_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

${STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES}

${PRO2_STORYBOARD_FEW_SHOT_COMPACT}`;

const STORY_PRO2_GU_FENG_APPENDIX_BASE = `
${PRO2_GU_FENG_CREATIVE_RULES}

${PRO2_GU_FENG_GFM_OUTPUT_RULES}

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
- 原 BGM/音效/慢镜 → **音效** 列 + **口型/配音备注** 列
- **禁止** Pass1 写 AI 视频列；Seedance 模板由 Pass2「生成提示词」完成
- 全剧反向词写入场景辞典「固定反向提示词」列（中文顿号分隔）`;

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
