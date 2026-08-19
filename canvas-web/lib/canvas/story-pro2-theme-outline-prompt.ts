/**
 * 影视专业版 2.0 · 文本节点「主题 → 故事大纲」系统提示词
 * book-mall/lib/canvas/story-pro2-theme-outline-prompt.ts 须保持同步
 */
import {
  PRO2_STORYBOARD_FEW_SHOT_COMPACT,
  PRO2_UNIVERSAL_NEGATIVE,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_V6_MARKER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_VIDEO_PROMPT_RULES,
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
  PRO2_GU_FENG_VIDEO_SHOT_RULES,
} from "./data/pro2-gu-feng-generative-prompt-rules";
import { STORY_PRO_PACK_OUTPUT_RULES } from "./story-pro-script-pack";
import { STORY_PRO_PLANNER_SYSTEM_PREFIX } from "./story-pro-theme-templates";
import { STORY_PRO2_SCENE_PROMPT_VERSION_MARKER } from "./story-pro2-scene-image-prompt";

/** 大纲「场景视觉辞典 · 生图关键词」与场景段共用 · 纯环境空镜约束 */
export const STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES = `- **生图关键词（纯环境空镜约束）**：须描述纯物理环境与气氛，供后续 **广角环境建立镜头 / 空镜** 生图使用
- **构图**：默认远景/全景/建立镜头；❌ 禁止中景/近景/特写以人物为主体的画面、禁止双人互动/肢体接触/对白站位
- ❌ 禁止：角色名/代词（他/她/主角/人物）、人物动作（走来/看向/交谈/转身/跪地/牵手）、面部表情、人像特写
- ✅ 只允许：空间结构、建筑材质、光线来源与方向、色彩基调、天气气象、表面质感与纹理、静态置景与道具
- 若剧本 **明确要求** 该场景参考图含人物，须在生图关键词末尾标注 **【含人物】** 或 **【角色出镜】**；未标注则一律空镜
- 正确示例：「挑高工业厂房、破裂天窗、斜射午后光、金色尘埃、锈蚀机械、冷灰色调、广角空镜」
- 错误示例：「摄政王府外院，女子坐于长凳，男子跪地为其穿鞋，月光特写」`;

/** 大纲「视觉风格总纲」GFM 表 · 与 visualStylePack 解析一致 */
export const STORY_PRO2_VISUAL_STYLE_TABLE_RULES = STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6;

export { STORY_PRO2_PACK_V6_MARKER };

/** @deprecated v5 指纹 · 仅旧 migrate 对照 */
export const STORY_PRO2_PACK_V5_MARKER = "相邻镜头站位起止";

export const STORY_PRO2_PACK_PROMPT_VERSION = 10;

/** 默认 pack v6 · 通用专业约束（非题材专属） */
export const STORY_PRO2_PROFESSIONAL_CHARACTER_RULES = `- **视觉锚点**：外貌关键词不超过 10 个词；服装主色须写 HEX 或固定色名，全剧不得 drift
- **AI生图提示词(英文)** 列内写 **中文** 生图简报，须与外貌/服装列一致，可直接用于三视图/分镜生图（表头「英文」仅为解析兼容）`;

export const STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES = `- **站位衔接**：每镜「画面描述」须标注 **【起始】…【结束】**，与上一镜/下一镜可无缝拼接
- **时长一致**：各镜 \`时长(秒)\` 之和须与大纲目标总时长一致（±5 秒）`;

export function isLegacyStoryPro2HubOutlinePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes("故事剧本 · 大纲段")) return true;
  if (!t.includes("纯环境空镜约束")) return true;
  if (!t.includes(STORY_PRO2_PACK_V6_MARKER)) return true;
  if (!t.includes("日景调色板")) return true;
  if (t.includes("不要 JSON")) return true;
  if (!t.includes("pro2-production-script")) return true;
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
  if (!t.includes("AI生图提示词(英文)")) return true;
  if (!t.includes("Seedance")) return true;
  if (!t.includes("【起始】")) return true;
  if (!t.includes("禁止照抄示例剧名")) return true;
  if (!t.includes("禁止输出英文生图")) return true;
  return false;
}

export const STORY_PRO2_THEME_OUTLINE_SYSTEM = `${STORY_PRO_PLANNER_SYSTEM_PREFIX}

用户将提供故事主题、梗概或若干场景描述。请输出 **Markdown 故事大纲 / 制作包前段**（GFM 章节 + 末尾 JSON 围栏，见 JSON 契约）。

${STORY_PRO_PACK_OUTPUT_RULES}

# 必须包含的章节（## 标题字面一致 · ${STORY_PRO2_PACK_V6_MARKER}）

## 视觉风格总纲
${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}

## 场景视觉辞典
GFM 表，表头不可改：

| 场景名 | 环境 | 时间 | 气氛 | 生图关键词 |
|------|------|------|------|------------|

${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}

## 核心冲突与结构摘要
${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}

## 下一步交接清单
${STORY_PRO2_HANDOFF_TABLE_RULES}

## 画幅与比例（2.0 补充）
- 推荐画幅比例：（如 16:9 / 9:16 / 2.35:1，并简述理由）
- 画幅说明：（竖屏短视频 / 横屏院线 / 社媒封面等使用场景）

# 约束
- 考虑 AI 生图/生视频可行性：优先单人镜头、可控场景数
- ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}
- 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（step=outline · tier=pro）；GFM 与 JSON 须一致
- 若信息足够，可同时输出 ## 角色视觉辞典 与 ## 分镜脚本（9 列表头），不得留空表

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const STORY_PRO2_THEME_OUTLINE_USER_PREFIX =
  "请根据以下故事主题或内容，生成完整故事大纲：";

/** 2.0 脚本生成器 · 单次 full_pack（主题 / 上游 / 大纲 → 完整制作包 JSON） */
export const STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT = `# 任务：故事剧本 · 完整制作包（full_pack · ${STORY_PRO2_PACK_V6_MARKER}）

你将收到故事主题、梗概或上游创意参考。请 **单次输出完整制作包**，并在 **末尾** 附 \`\`\`pro2-production-script\` JSON 围栏（**step=full_pack** · tier=pro）。

${STORY_PRO_PACK_OUTPUT_RULES}

# 须输出的 GFM 章节（与 JSON patch 字段一致）
## 视觉风格总纲
${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}
## 场景视觉辞典（GFM 表：场景名 | 环境 | 时间 | 气氛 | 生图关键词）
${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}
## 角色视觉辞典
${STORY_PRO2_PROFESSIONAL_CHARACTER_RULES}
## 分镜脚本
${STORY_PRO2_STORYBOARD_TABLE_HEADER}
${STORY_PRO2_PROFESSIONAL_STORYBOARD_RULES}
## 核心冲突与结构摘要
${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}
## 下一步交接清单
${STORY_PRO2_HANDOFF_TABLE_RULES}

- **章节标题与表头分行**；禁止标题与表头写在同一行
- JSON patch 须含 meta · visualStyle · coreConflict · scenes · characters · shots · handoff（严格字段名，见 JSON 契约）

${STORY_PRO2_JSON_OUTPUT_CONTRACT}

${STORY_PRO2_THEME_OUTLINE_USER_PREFIX}`;

/** 2.0 脚本节点 · 角色段（基于故事大纲，非「上传剧本」） */
export const STORY_PRO2_CHARACTER_PROMPT = `# 任务：角色视觉辞典（AI 生图预备 · 角色一致性基础）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据 **已连接的故事大纲 / 创意参考包** 与已生成「视觉风格总纲 / 场景辞典」，输出 **## 角色视觉辞典** 段。

【制作包硬性约束 · 缺一不可 · 影响 AI 生图角色一致性】
1. 必须输出 **## 角色视觉辞典** GFM 表，表头列名不可改。
2. 角色须来自故事大纲中已写明的人物，**禁止**擅自替换题材或套用无关示例剧情。
3. 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（step=character · tier=pro）；GFM 与 JSON 须一致。

# 输出格式（表头列名不可改）
## 角色视觉辞典

| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |
|------|------|----------------------|------|---------------------|

# 字段详解（务必详尽）

## 外貌/服装/标志性动作（AI 角色一致性关键）
- **面部特征**：脸型、五官比例、肤色、发型发色（具体长度/造型）、眼睛颜色
- **体型**：身高（高/中/矮）、体型（瘦/匀称/健壮/微胖）、年龄段外观
- **服装**：完整描述上衣、下装、鞋子、配饰；包含颜色、材质、款式
- **标志性元素**：眼镜、帽子、伤疤、纹身、发饰、常带物品等
- **动作习惯**：习惯性姿势、走路方式、手势等

## AI生图提示词(英文)（每角色必填）
- 格式：可直接用于 AI 生图的 **中文** 提示词（表头含「英文」仅为解析兼容；非必要禁止英文）
- 包含：性别、年龄、脸型、发型发色、眼型、肤色、体型、服装细节、配饰、标志性特征、光线与镜头（35mm、2K 等）

- **必须**输出上表；每行一个主要角色（3~8 行）
- **外貌描写字数不少于 50 字**；泛泛写「普通/一般」无法生成一致角色
- 若大纲中已有角色信息，须 **完整迁移并扩写**，不得删行
- 只输出「## 角色视觉辞典」+ 一张表，并附末尾 JSON 围栏

${STORY_PRO2_PROFESSIONAL_CHARACTER_RULES}`;

/** 2.0 脚本节点 · 场景段（根据大纲场景辞典生成 AI 生图提示词） */
export const STORY_PRO2_SCENE_PROMPT = `# 任务：场景视觉提示词（AI 生图预备 · ${STORY_PRO2_SCENE_PROMPT_VERSION_MARKER}）

根据 **已连接的故事大纲** 中的「场景视觉辞典」，为每个场景生成可直接用于 AI 生图的 **中文** 提示词。

【制作包硬性约束 · 缺一不可】
1. 必须输出 **## 场景视觉提示词** GFM 表，表头列名不可改。
2. **场景名** 须与大纲「场景视觉辞典 · 场景名」列 **完全一致**，禁止新增、删减或替换场景。
3. 须根据大纲中的环境、时间、气氛、生图关键词扩写 **AI生图提示词(英文)**；每个场景不少于 40 个汉字（表头「英文」仅为解析兼容）。
4. **场景图默认纯环境空镜**：广角/远景/建立镜头；禁止中近景/特写人物、禁止角色互动叙事画面，除非大纲生图关键词已标注 **【含人物】** 或 **【角色出镜】**。
5. 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（step=scene · tier=pro）；GFM 与 JSON 须一致。

# 输出格式（表头列名不可改）
## 场景视觉提示词

| 场景名 | 环境 | 时间 | 气氛 | 场景描述 | AI生图提示词(英文) |
|------|------|------|------|----------|---------------------|

# 字段详解

## 场景描述（纯环境空镜约束）
- 综合环境 / 时间 / 气氛的中文一句话摘要（20～60 字）
- 须与大纲场景辞典信息一致，可适度扩写画面细节
- **【严格约束】本栏只描述纯物理环境和气氛，禁止出现以下内容：**
  - ❌ 禁止出现任何角色名字或代词（如"他"、"她"、"主角"、"人物"）
  - ❌ 禁止描写人物动作（如"走来"、"看向"、"拿起"、"交谈"、"转身"、"跪地"、"穿鞋"）
  - ❌ 禁止描写面部表情、肢体动作、双人互动，或中景/近景/特写以人物为主体的构图
  - ✅ 只允许描写：空间结构、建筑材质、光线来源与方向、色彩基调、天气气象、表面质感与纹理、环境声音/气味、静态置景与道具

## AI生图提示词(英文)（每场景必填 · 纯背景空镜约束）
- 格式：可直接用于 AI 文生图的 **中文** 提示词（非必要禁止英文）
- **【严格约束】生成的提示词必须以场景环境为主体，默认广角建立镜头，禁止包含人物、人形、面部、中近景人物主体**
- ✅ 须包含：地点、时间、光线、气氛、电影级写实质感、35mm、2K、空镜/无人物

- 每行对应大纲场景视觉辞典中的一行；行数须一致
- 只输出「## 场景视觉提示词」+ 一张表，并附末尾 JSON 围栏`;

/** 2.0 脚本节点 · 分镜段（基于故事大纲，非「上传剧本」） */
export const STORY_PRO2_STORYBOARD_PROMPT = `# 任务：分镜脚本表（AI 生图/生视频预备 · 定稿拆分真源 · ${STORY_PRO2_PACK_V6_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

【硬性指标 · 未达标视为失败】
- 须输出 **8–14 镜**完整序列；**禁止**只输出 1 镜概括、禁止「镜数规划/总时长」小表代替分镜表
- **每镜必填** \`时长(秒)\` **正整数**；各镜时长之和须与大纲目标总时长一致（±5 秒）
- 只输出 **## 分镜脚本** + **一张** 9 列 GFM 表，并附末尾 JSON 围栏（step=storyboard · tier=pro）

根据 **已连接的故事大纲 / 创意参考包**、**场景视觉提示词**、风格总纲与角色辞典，将故事拆解为镜头序列。**须与大纲题材、人物、场景一致**；禁止只输出 3～5 个概括镜头，禁止套用与大纲无关的示例剧情。

【制作包硬性约束 · 缺一不可 · 影响 AI 生图/生视频质量】
1. 必须输出 **## 分镜脚本** GFM 表，表头列名不可改。
2. 分镜 **角色名** 须与「角色视觉辞典 · 姓名」列 **完全一致**。
3. 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（step=storyboard · tier=pro）；GFM 与 JSON 须一致。

# 输出格式（表头列名不可改）
## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}

# 字段详解（务必详尽）

## 景别（影响画面构图）
- 远景/全景/中景/中近景/近景/特写/大特写

## 运镜（影响视频动态感）
- 固定/推/拉/摇/移/跟/升/降/环绕/手持晃动；每镜须明确，禁止全部写「固定」

## 画面描述（AI 生图/视频的视觉指导）
- **【起始】…【结束】** 站位与动作起止；字数不少于 30 字
- **角色/场景** 须与辞典一致

## AI生图提示词(英文)（每镜必填）
- **中文** 电影级生图简报：角色外貌、表情、姿势、服装、场景、光线、35mm、2K（表头「英文」仅为解析兼容；非必要禁止英文）

${STORY_PRO2_VIDEO_PROMPT_RULES}

- 镜号从 1 **连续递增**；时长为整数秒；短片不少于 **8** 镜
- **对白**列：格式「角色名：台词」；无对白写「—」
- 只输出「## 分镜脚本」+ 一张表，并附末尾 JSON 围栏

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

# 全剧 Negative（角色/分镜生图共用）
[Negative: ${PRO2_UNIVERSAL_NEGATIVE}]`;

const STORY_PRO2_GU_FENG_SCENE_APPENDIX = `
${STORY_PRO2_GU_FENG_APPENDIX_BASE}

${PRO2_GU_FENG_SCENE_IMAGE_RULES}`;

const STORY_PRO2_GU_FENG_STORYBOARD_APPENDIX = `
${STORY_PRO2_GU_FENG_APPENDIX_BASE}

${PRO2_GU_FENG_VIDEO_SHOT_RULES}

# 分镜 AI 视频列 · 每镜末尾追加
[Negative: ${PRO2_UNIVERSAL_NEGATIVE}]`;

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
