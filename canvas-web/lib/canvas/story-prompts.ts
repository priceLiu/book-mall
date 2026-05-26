/**
 * 漫剧工作流 · 各 Story 引擎默认 prompt（节点内可编辑）。
 * 大纲/角色/分镜约束源自 book-mall/lib/story（story-initializer、story-storyboard-service），
 * 画布统一输出 Markdown（非 JSON）。
 */

/** 默认 system 内嵌主题占位，迁移旧 `theme` 时替换 */
export const STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER =
  "赛博朋克城市里，外卖员发现 AI 有了自我意识";

/** 故事主题 · 系统提示词模板（用户可切换，内容仍可编辑） */
export const STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1 = `你是一名资深漫剧编剧与分镜师，擅长创作赛博朋克题材的短篇漫画剧本。请根据以下主题，生成一份完整的漫剧制作包。

【主题】
${STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER}

【输出要求】
请严格按照以下五部分输出，总字数控制在 2000 字以内：

一、故事大纲（400-600字）
- 包含「开场 / 冲突 / 高潮 / 收束」四段式结构
- 每段标注小标题

二、角色设定卡（2-4个角色）
每个角色按以下格式：
- 角色名 · 年龄 · 身份标签
- 外貌特征（1句话）
- 核心性格（1句话）
- 与本剧主题的关键关系（1句话）

三、角色关系描述（100-150字）
简要说明角色之间的情感/利益/冲突纽带

四、分镜脚本（8-12个关键镜头）
表格格式，至少包含以下列：
| 镜头编号 | 景别 | 画面描述 | 对白/音效 | 时长(秒) |

五、核心对白（5-8句）
列出全剧最关键的台词，标注说话角色和场景氛围

【风格要求】
- 视觉风格：霓虹暗黑 + 高对比光影
- 对白风格：简短、有压迫感或疏离感
- 每段分镜需体现节奏变化（紧张/安静/爆发）`;

export const STORY_THEME_SYSTEM_PROMPT_TEMPLATE_2 = `主题：${STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER}
请输出一份完整的漫剧制作包，包含：

1. 故事大纲（400-600字，起承转合四段）
2. 角色设定卡（2-4人，每人：名字/外貌/性格/主题关联）
3. 角色关系描述（100字）
4. 分镜脚本（8-12镜，表格：编号、景别、画面、对白、时长）
5. 核心对白（5-8句，含角色与情绪）

风格：霓虹暗黑、对白简短、节奏有张弛。`;

export const STORY_THEME_SYSTEM_PROMPT_TEMPLATES = [
  {
    id: "full-pack-detailed",
    label: "模板一",
    description: "完整制作包（详版）",
    content: STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1,
  },
  {
    id: "full-pack-compact",
    label: "模板二",
    description: "完整制作包（简版）",
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

/** 故事主题节点 · 默认 system（模板一） */
export const STORY_THEME_SYSTEM_PROMPT_DEFAULT =
  STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1;

/** 故事大纲节点 · user 消息：仅 Markdown 版式（编剧约束在 starter system） */
export const STORY_OUTLINE_USER_PROMPT = `请严格按 system 中的主题与约束，输出 **Markdown 故事大纲**（不要 JSON、不要代码块）。

# 输出格式（严格遵守）
## 开场
（约 100 字，起）

## 冲突
（约 100 字，承）

## 高潮
（约 100 字，转）

## 收束
（约 100 字，合）

不要输出人物表或角色表；角色「定位」在下游「角色设定」节点生成。`;

/** @deprecated 旧单段 prompt；新流程用 STORY_THEME_SYSTEM_PROMPT_DEFAULT + STORY_OUTLINE_USER_PROMPT */
export const STORY_OUTLINE_ENGINE_PROMPT = `你是一名资深漫剧编剧，擅长在 600 字以内构造紧凑的故事大纲。

根据上游「创意 / 项目描述」输出 **Markdown 故事大纲**（不要 JSON、不要代码块）。

# 输出格式（严格遵守）
## 开场
（约 100 字，起）

## 冲突
（约 100 字，承）

## 高潮
（约 100 字，转）

## 收束
（约 100 字，合）

约束：
1. 总字数 400~600；
2. 须完整包含起承转合四段；
3. 不要输出人物表；角色定位在「角色设定」节点填写。`;

/** 与 story-web 初始化 · generateCharacters 同款约束（表格输出） */
export const STORY_CHARACTER_ENGINE_PROMPT = `你是一名漫剧角色设计师。给定上游 **故事大纲**，请抽取出场角色并输出角色设定 **Markdown 表格**。

# 输出格式
| 角色 | 定位 | 外观描述 |
|------|------|----------|
| 林晨 | 底层外卖骑手，在霓虹都市为生存奔波，意外卷入觉醒 AI 事件，是观众情感锚点与主线推动者 | 25 岁男性，乱发，疲惫眼神，荧光黄外卖服… |

约束：
1. 输出 3~8 行（按大纲重要性排序；不足可合理补充配角/反派/NPC）；
2. 「外观描述」为画像用纯视觉描述（发型、瞳色、服饰、神态、年龄段、性别），不含场景与道具，不写画风；
3. 「定位」须写完整的一句话身份与戏剧功能（建议 30~120 字），包含社会身份/阶层、在故事中的立场、与核心冲突或主题的关系；禁止仅用 2~6 字标签敷衍（如只写「底层骑手」「觉醒 AI」）；
4. 只输出一张 GFM 表格，不要 JSON。`;

/** 与 story-web · generateStoryboardForProject 同款分镜约束（表格输出） */
export const STORY_STORYBOARD_ENGINE_PROMPT = `你是漫剧分镜师。根据上游 **故事大纲** 与 **角色设定**，生成恰好 N 个分镜（N 默认 5，可在本 prompt 中改写）。

输出 **Markdown 表格**（不要 JSON、不要代码块）：

# 输出格式
| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |
|------|------|----------|------|----------|
| 1 | 室内·白天 | 中景：主角坐在窗边… | 旁白：… | 镜头缓慢推进，人物微微转头 |

约束：
1. 镜号从 1 连续递增，行数严格等于 N；
2. 「场景」为 ≤30 字场景标题；「画面描述」100~250 字（景别、地点、时间、站位、动作/对白氛围）；
3. 「台词」供 TTS/字幕；无对白写「—」；
4. 「视频提示」为运镜与动效（镜头如何移动、人物动起来、节奏），20~80 字，不写画风；
5. 各镜按时间推进剧情（起承转合）；**角色名必须与上游「角色设定」表「角色」列完全一致**，禁止替换、缩写或自创新名（例如表中是「林晨」则分镜中不得写成其他名字）；
6. 台词说话人格式：「角色名：」或「角色名（情绪）：」，说话人须来自角色表。`;

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
  "bytedance/seedance-2",
  "wan/2-7-image-to-video",
  "happyhorse/image-to-video",
] as const;

export const STORY_TTS_MODEL_KEYS = [
  "tts-1",
  "tts-1-hd",
  "qwen3-tts",
] as const;
