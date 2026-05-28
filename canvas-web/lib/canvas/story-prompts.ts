/**
 * 漫剧工作流 · 各 Story 引擎默认 prompt（节点内可编辑）。
 * 大纲/角色/分镜约束源自 book-mall/lib/story（story-initializer、story-storyboard-service），
 * 画布统一输出 Markdown（非 JSON）。
 */

/** 制作包 prompt 版本：加载画布时低于此版本的节点会自动刷新内置模板与 hub 段 prompt */
export const STORY_PACK_PROMPT_VERSION = 2;

/** 旧版大纲 user prompt 指纹（用于迁移） */
export const STORY_LEGACY_OUTLINE_USER_MARK = "不要输出人物表";

/** 默认 system 内嵌主题占位，迁移旧 `theme` 时替换 */
export const STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER =
  "赛博朋克城市里，外卖员发现 AI 有了自我意识";

/** 故事大纲 LLM 默认参数：长参考包 + 完整输出 */
export const STORY_OUTLINE_LLM_PARAMS = {
  reasoning_effort: "low" as const,
  max_tokens: 16000,
  temperature: 0.7,
};

/**
 * 漫剧制作包 · 画布可解析的 Markdown 骨架（真源）。
 * system / user prompt 须与此一致，保存后自动拆入「角色设定 / 分镜脚本 / 对白」Tab。
 */
export const STORY_PACK_MARKDOWN_STRUCTURE = `# 制作包结构（## 标题字面一致 · GFM 表头不可改列名）

## 开场
（起 · 完整展开，无字数上限）

## 冲突
（承）

## 高潮
（转）

## 收束
（合）

## 角色设定

| 角色 | 定位 | 外观描述 |
|------|------|----------|
| （示例）林晨 | 底层外卖骑手，意外卷入 AI 觉醒事件，是观众情感锚点 | 25 岁男性，乱发，疲惫眼神，荧光黄外卖服 |

## 分镜脚本

| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |
|------|------|----------|------|----------|
| 1 | 室内·夜 | 中景：主角坐在窗边… | 林晨：…… 或 — | 镜头缓慢推进，人物微微转头 |`;

/** 制作包硬性约束（system / user 共用摘要） */
export const STORY_PACK_OUTPUT_RULES = `【制作包硬性约束 · 缺一不可】
1. 必须输出 **全部六个 ## 章节**：开场、冲突、高潮、收束、角色设定、分镜脚本；禁止只写故事梗概或省略表格。
2. 「角色设定」「分镜脚本」必须是 **GFM 表格**，表头列名与骨架 **完全一致**（「角色」「定位」「外观描述」「镜号」「场景」「画面描述」「台词」「视频提示」）。
3. 角色表 **3~8 行**；分镜表 **8~12 镜**（极短题材不少于 5 镜），镜号从 1 **连续递增**。
4. 「台词」列：有对白写「角色名：台词」；无对白写「—」；**禁止**只写在画面描述里而不填台词列（对白 Tab 依赖此列）。
5. 分镜中的 **角色名** 必须与「角色设定」表「角色」列 **完全一致**（禁止缩写、替换或自创新名）。
6. 不要 JSON；不要用 \`\`\` 代码块包裹全文；不要用「一、二、三」代替 ## 标题。`;

/** 故事主题 · 系统提示词模板（用户可切换，内容仍可编辑） */
export const STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1 = `你是一名资深编剧与分镜师，擅长创作赛博朋克题材的短篇漫剧。请根据以下主题，输出 **一份可被系统自动解析的完整制作包**（Markdown）。

【主题】
${STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER}

${STORY_PACK_OUTPUT_RULES}

【输出骨架 · 严格遵守】
${STORY_PACK_MARKDOWN_STRUCTURE}

【风格要求】
- 视觉：霓虹暗黑 + 高对比光影
- 对白：简短、有压迫感或疏离感
- 分镜节奏：紧张 / 安静 / 爆发交替`;

export const STORY_THEME_SYSTEM_PROMPT_TEMPLATE_2 = `主题：${STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER}

请输出 **完整漫剧制作包**（Markdown），结构与表头须与下列骨架 **字面一致**：

${STORY_PACK_MARKDOWN_STRUCTURE}

${STORY_PACK_OUTPUT_RULES}

风格：霓虹暗黑、对白简短、节奏有张弛。`;

export const STORY_THEME_SYSTEM_PROMPT_TEMPLATES = [
  {
    id: "full-pack-detailed",
    label: "模板一 · 完整制作包",
    description: "起承转合 + ## 角色设定表 + ## 分镜脚本表（画布自动拆分）",
    content: STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1,
  },
  {
    id: "full-pack-compact",
    label: "模板二 · 完整制作包",
    description: "简版 · 同样须含角色表与分镜 GFM 表",
    content: STORY_THEME_SYSTEM_PROMPT_TEMPLATE_2,
  },
] as const;

export type StoryThemeSystemPromptTemplateId =
  (typeof STORY_THEME_SYSTEM_PROMPT_TEMPLATES)[number]["id"];

export function storyThemeSystemPromptForTemplate(
  id: StoryThemeSystemPromptTemplateId,
): string {
  const hit = STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find((t) => t.id === id);
  return hit?.content ?? STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1;
}

export function matchStoryThemeSystemPromptTemplateId(
  systemPrompt: string,
): StoryThemeSystemPromptTemplateId | undefined {
  const t = systemPrompt.trim();
  if (!t) return undefined;
  for (const tpl of STORY_THEME_SYSTEM_PROMPT_TEMPLATES) {
    if (t === tpl.content.trim()) return tpl.id;
  }
  return undefined;
}

/** 从 system 提示词中提取用户填写的主题（迁移 / 刷新模板时保留） */
export function extractThemeFromStorySystemPrompt(prompt: string): string {
  const t = prompt.trim();
  const bracket = t.match(/【主题】\s*\n+\s*([^\n【]+)/);
  if (bracket?.[1]?.trim()) return bracket[1].trim();
  const colon = t.match(/^主题：\s*(.+)$/m);
  if (colon?.[1]?.trim()) return colon[1].trim();
  return STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER;
}

export function applyThemeToStorySystemPrompt(
  templateContent: string,
  theme: string,
): string {
  return templateContent.replace(
    STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER,
    theme,
  ).replace(
    /^主题：.*$/m,
    `主题：${theme}`,
  );
}

/** 旧版「一、二、三」制作包 system（无 ## 角色设定 / 分镜脚本 表） */
export function isLegacyStoryPackSystemPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (t.includes("【制作包硬性约束")) return false;
  if (t.includes("## 角色设定") && t.includes("## 分镜脚本")) return false;
  if (/一、故事大纲/.test(t)) return true;
  if (/五、核心对白/.test(t)) return true;
  if (t.includes(STORY_LEGACY_OUTLINE_USER_MARK)) return true;
  return false;
}

export function storyHubDefaultPromptPack(): {
  promptOutline: string;
  promptCharacter: string;
  promptStoryboard: string;
} {
  return {
    promptOutline: STORY_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_CHARACTER_ENGINE_PROMPT,
    promptStoryboard: STORY_STORYBOARD_ENGINE_PROMPT,
  };
}

/** 故事主题节点 · 默认 system（模板一） */
export const STORY_THEME_SYSTEM_PROMPT_DEFAULT =
  STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1;

/** 故事大纲节点 · user 消息：完整制作包（编剧约束在 starter system） */
export const STORY_OUTLINE_USER_PROMPT = `请严格按 system 中的主题与约束，输出 **完整漫剧制作包 Markdown**（不要 JSON、不要用 code 块包裹全文）。

${STORY_PACK_OUTPUT_RULES}

# 输出骨架（## 标题与表头列名不可改）
${STORY_PACK_MARKDOWN_STRUCTURE}

补充：
- 起承转合四段须完整展开，无字数上限，不得压缩省略。
- 若 system 未指定镜数，分镜表默认 **8~12 镜**。
- 本次须 **一次性** 输出角色表 + 分镜表；不要留空或写「见下游生成」。`;

/** @deprecated 旧单段 prompt；新流程用 STORY_THEME_SYSTEM_PROMPT_DEFAULT + STORY_OUTLINE_USER_PROMPT */
export const STORY_OUTLINE_ENGINE_PROMPT = `你是一名资深漫剧编剧。根据上游「创意 / 项目描述」输出 **完整制作包 Markdown**（不要 JSON、不要代码块）。

${STORY_PACK_OUTPUT_RULES}

# 输出骨架
${STORY_PACK_MARKDOWN_STRUCTURE}`;

/** 与 story-web 初始化 · generateCharacters 同款约束（表格输出） */
export const STORY_CHARACTER_ENGINE_PROMPT = `你是一名漫剧角色设计师。给定上游 **故事大纲**，请抽取出场角色并输出 **## 角色设定** 段（仅一张 GFM 表格，不要 JSON、不要 code 块）。

# 输出格式（表头列名不可改）
## 角色设定

| 角色 | 定位 | 外观描述 |
|------|------|----------|
| 林晨 | 底层外卖骑手，在霓虹都市为生存奔波，意外卷入觉醒 AI 事件，是观众情感锚点与主线推动者 | 25 岁男性，乱发，疲惫眼神，荧光黄外卖服… |

约束：
1. **必须**输出上表；3~8 行（按大纲重要性排序；不足可合理补充配角/反派/NPC）；
2. 「外观描述」为画像用纯视觉描述（发型、瞳色、服饰、神态、年龄段、性别），不含场景与道具，不写画风；
3. 「定位」须写完整的一句话身份与戏剧功能（建议 30~120 字），包含社会身份/阶层、在故事中的立场、与核心冲突或主题的关系；禁止仅用 2~6 字标签敷衍（如只写「底层骑手」「觉醒 AI」）；
4. 若大纲中已有「## 角色设定」表，须 **完整迁移并扩写**，不得删行或留空；
5. 只输出「## 角色设定」标题 + 一张表格，不要额外散文。`;

/** 与 story-web · generateStoryboardForProject 同款分镜约束（表格输出） */
export const STORY_STORYBOARD_ENGINE_PROMPT = `你是漫剧分镜师。根据上游 **故事大纲** 与 **角色设定**，生成 **## 分镜脚本** 段（仅一张 GFM 表格，不要 JSON、不要 code 块）。

生成恰好 **N 个分镜**（N 默认 8，可在本 prompt 中改写；短剧不少于 5 镜）。

# 输出格式（表头列名不可改）
## 分镜脚本

| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |
|------|------|----------|------|----------|
| 1 | 室内·白天 | 中景：主角坐在窗边… | 林晨：…… | 镜头缓慢推进，人物微微转头 |

约束：
1. **必须**输出上表；镜号从 1 连续递增，行数严格等于 N；
2. 「场景」为 ≤30 字场景标题；「画面描述」100~250 字（景别、地点、时间、站位、动作/对白氛围）；
3. 「台词」列供 TTS/字幕与「对白」Tab：**有对白**写「角色名：台词」或「角色名（情绪）：台词」；**无对白**写「—」；禁止只写在画面描述里；
4. 「视频提示」为运镜与动效（镜头如何移动、人物动起来、节奏），20~80 字，不写画风；
5. 各镜按时间推进剧情（起承转合）；**角色名必须与上游「角色设定」表「角色」列完全一致**，禁止替换、缩写或自创新名；
6. 若大纲中已有分镜表，须按剧情 **拆细为 N 镜** 并补全台词列，不得概括成 3~5 个镜头。`;

/** @deprecated 旧分镜图引擎节点占位；工作区列行使用 buildFrameRowScriptPrompt */
export const STORY_FRAME_IMAGE_PROMPT_DEFAULT = "";

export const STORY_VIDEO_ENGINE_PROMPT_DEFAULT =
  "根据上游「视频提示」与分镜图，生成短视频片段。";

/** Story LLM 引擎建议模型（KIE / 用户 Provider 均可） */
export const STORY_LLM_MODEL_KEYS = [
  "google/gemini-3-flash-preview",
  "gemini-3-flash",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "qwen-plus",
  "qwen-max",
] as const;

export const STORY_VIDEO_MODEL_KEYS = [
  "kling-2.6/image-to-video",
  "bytedance/seedance-2",
  "wan/2-7-image-to-video",
  "happyhorse/image-to-video",
] as const;

/** 影视专业版 · 百炼参考生视频（Gateway · 百炼，非 KIE 直连） */
export const STORY_PRO_VIDEO_BAILIAN_MODEL_KEYS = [
  "happyhorse-1.0-r2v",
  "wan2.7-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
] as const;

/** 影视专业版分镜视频 · KIE 图生/多参考 + 百炼 R2V */
export const STORY_PRO_VIDEO_MODEL_KEYS = [
  ...STORY_VIDEO_MODEL_KEYS,
  ...STORY_PRO_VIDEO_BAILIAN_MODEL_KEYS,
] as const;

/**
 * 影视专业版 · 分镜静帧（IMAGE）白名单
 * 与 KIE_KNOWN_MODELS 对齐；含多参考图（image_input / image_urls / input_urls）
 */
export const STORY_PRO_FRAME_IMAGE_MODEL_KEYS = [
  "nano-banana-pro",
  "flux-2-pro",
  "seedream-5-lite",
  "seedream-4.5",
  "gpt-image-2",
  "gpt-image-1",
  /** 混元经 Gateway HUNYUAN，非 KIE，但支持专业版三视图/静帧 */
  "hunyuan-3d-pro",
  "hunyuan-3d-express",
] as const;

/** 仅单参考图（image_url），无 @ 多角色时可选 */
export const STORY_PRO_FRAME_IMAGE_SINGLE_REF_MODEL_KEYS = [
  "qwen-text-to-image",
] as const;

export const STORY_TTS_MODEL_KEYS = [
  "qwen3-tts",
  "tts-1",
  "tts-1-hd",
] as const;
