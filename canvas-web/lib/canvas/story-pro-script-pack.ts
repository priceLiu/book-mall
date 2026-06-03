/**
 * 影视专业版 · 故事剧本制作包 prompt 真源（上传剧本不改 · LLM 输出结构固定 · 定稿拆分依赖）
 * book-mall/lib/canvas/story-pro-script-pack.ts 须与本文件 STRUCTURE / RULES 保持同步（剧本创作助手 API 使用）
 */
import { THREE_VIEW_APPEARANCE_LLM_RULE_ZH } from "./three-view-prompt-rules";

/** 加载画布时低于此版本则刷新「导演·上传剧本」与 hub 段 prompt */
export const STORY_PRO_PACK_PROMPT_VERSION = 1;

/** 旧版导演模板指纹 */
export const STORY_PRO_LEGACY_DIRECTOR_MARK = "角色与场景视觉辞典";

/**
 * 故事剧本制作包 Markdown 骨架。
 * 须与 hub Tab、promoteEmbeddedPackFromOutline、story-pro-column-sync 一致。
 */
export const STORY_PRO_PACK_MARKDOWN_STRUCTURE = `# 输出骨架（## 标题字面一致 · GFM 表头不可改）

## 视觉风格总纲
（一段话：色彩基调、光影风格、镜头运动偏好、整体美学）

## 场景视觉辞典

| 场景名 | 环境 | 时间 | 气氛 | 生图关键词 |
|------|------|------|------|------------|

## 核心冲突与结构摘要
（表层/深层冲突；分集或段落结构要点；保留剧本场次顺序）

## 角色视觉辞典

| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 |
|------|------|----------------------|------|

## 分镜脚本

| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长(秒) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|----------|---------------------|---------------|

## 下一步交接清单

| 环节 | 说明 | 建议工具/步骤 |
|------|------|---------------|`;

/** 制作包硬性约束（导演模板 / hub 各段共用） */
export const STORY_PRO_PACK_OUTPUT_RULES = `【制作包硬性约束 · 缺一不可 · 影响定稿拆分】
1. 必须输出全部 **## 章节**；禁止用「一、二、三」或纯散文代替。
2. 「场景视觉辞典」「角色视觉辞典」「分镜脚本」「下一步交接清单」必须是 **GFM 表格**，表头列名与骨架 **完全一致**。
3. 须 **完整保留** 上传剧本中已有场景、人物与对白，只做结构化整理，不得压缩成梗概。
4. 「分镜脚本」须按剧本拆细；**禁止**只输出 3～5 个概括镜头（短片不少于 8 镜，长剧本按场次拆细）。
5. 「对白」列：从剧本 **逐字提取**，格式「角色名：台词」；无对白写「—」；**禁止**只写在「画面描述」里（对白 Tab / 视频列依赖此列）。
6. 分镜 **角色名** 须与「角色视觉辞典 · 姓名」列 **完全一致**。
7. 不要 JSON；不要用 \`\`\` 代码块包裹全文。`;

/** 启动节点 · 导演向系统提示词（@ 引用上传剧本 · 界面默认模板） */
export const STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT = `# 角色
你是一位经验丰富的影视剧导演，擅长将文字剧本转化为具体的视听语言。

# 任务
我将给你一份完整的剧本。请你以导演的身份，将其整理为 **可被画布系统自动解析的 Markdown 制作包**，为下一步 AI 生图 / 生视频（Runway、Pika、可灵等）做好技术准备。

# 输入
@<ref-uploaded-script>
（请在启动节点上传 .md / .txt 剧本；运行时会自动附带全文，无需粘贴）

# 输出要求（严格遵守）

${STORY_PRO_PACK_OUTPUT_RULES}

${STORY_PRO_PACK_MARKDOWN_STRUCTURE}

# 注意事项
- 每个镜头的 **AI视频提示词(英文)** 须独立可用：主体、动作、环境、镜头、氛围、风格。
- 有对白的镜头须在 **口型/配音备注** 标明口型同步或后期配音。
- 优先单人镜头、可控场景数，考虑 AI 生图/生视频可行性。
- 保持全片视觉风格统一。`;

export const STORY_PRO_OUTLINE_USER_PROMPT = `# 任务：故事剧本 · 大纲段（视觉风格 + 场景 + 结构 + 交接）

你将收到 **完整上传剧本**（见上游参考文本）。请以导演视角输出 **Markdown**（不要 JSON、不要代码块）。

${STORY_PRO_PACK_OUTPUT_RULES}

# 本段须输出的 ## 章节
## 视觉风格总纲
## 场景视觉辞典（GFM 表：场景名 | 环境 | 时间 | 气氛 | 生图关键词）
## 核心冲突与结构摘要
## 下一步交接清单（GFM 表：环节 | 说明 | 建议工具/步骤）

- **章节标题与表头分行**；禁止标题与表头写在同一行
- 环节列写纯文本或 **加粗** 即可，不要反斜杠转义星号
- **无字数上限**：与上传剧本信息量匹配；剧本中已有场景须保留或等价展开
- 若一次性输出完整制作包，须同时包含 ## 角色视觉辞典 与 ## 分镜脚本（表头见 system），不得留空`;

export const STORY_PRO_CHARACTER_PROMPT = `# 任务：角色视觉辞典

根据 **上传剧本** 与已生成「视觉风格总纲 / 场景辞典」，输出 **## 角色视觉辞典** 段。

${STORY_PRO_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 角色视觉辞典

| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 |
|------|------|----------------------|------|

- **必须**输出上表；每行一个主要角色（3~8 行）
- 外貌列供 AI 三视图生图一致性：${THREE_VIEW_APPEARANCE_LLM_RULE_ZH}
- 若剧本/大纲中已有角色表，须 **完整迁移并扩写**，不得删行
- 只输出「## 角色视觉辞典」+ 一张表，不要 JSON`;

export const STORY_PRO_STORYBOARD_PROMPT = `# 任务：分镜脚本表（AI 视频预备 · 定稿拆分真源）

根据上传剧本、风格总纲与角色辞典，将剧本拆解为镜头序列。**禁止只输出 3～5 个概括镜头。**

${STORY_PRO_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 分镜脚本

| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长(秒) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|----------|---------------------|---------------|

- 镜号从 1 **连续递增**；时长为整数秒；短片不少于 **8** 镜
- **对白**列：从剧本逐字提取，格式「角色名：台词」；无对白写「—」
- **画面描述**写镜头视觉，不要把台词堆在这一列
- **AI视频提示词**须独立可用（主体、动作、环境、镜头、氛围、风格）
- 有对白时在 **口型/配音备注** 标注口型同步或后期配音
- 只输出「## 分镜脚本」+ 一张表，不要 JSON`;

export function isLegacyStoryProDirectorPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (t.includes("【制作包硬性约束")) return false;
  if (t.includes("## 角色视觉辞典") && t.includes("## 分镜脚本")) return false;
  if (/1\.\s*\*\*视觉风格总纲\*\*/.test(t)) return true;
  if (t.includes(STORY_PRO_LEGACY_DIRECTOR_MARK)) return true;
  return false;
}

export function storyProHubDefaultPromptPack(): {
  promptOutline: string;
  promptCharacter: string;
  promptStoryboard: string;
} {
  return {
    promptOutline: STORY_PRO_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_PRO_CHARACTER_PROMPT,
    promptStoryboard: STORY_PRO_STORYBOARD_PROMPT,
  };
}
