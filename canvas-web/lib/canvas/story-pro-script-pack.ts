/**
 * 影视专业版 · 故事剧本制作包 prompt 真源（上传剧本不改 · LLM 输出结构固定 · 定稿拆分依赖）
 * book-mall/lib/canvas/story-pro-script-pack.ts 须与本文件 STRUCTURE / RULES 保持同步（剧本创作助手 API 使用）
 */
import {
  PRO2_DEFAULT_SHOT_GFM_EXAMPLE,
  PRO2_HANDOFF_EXAMPLE_ROWS,
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_HANDOFF_TABLE_HEADER,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_V7_MARKER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_VIDEO_PROMPT_RULES,
  STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6,
} from "./data/pro2-production-pack-standard";
import { THREE_VIEW_APPEARANCE_LLM_RULE_ZH } from "./three-view-prompt-rules";

/** 加载画布时低于此版本则刷新「导演·上传剧本」与 hub 段 prompt */
export const STORY_PRO_PACK_PROMPT_VERSION = 5;

/** 旧版导演模板指纹 */
export const STORY_PRO_LEGACY_DIRECTOR_MARK = "角色与场景视觉辞典";

/**
 * 故事剧本制作包 Markdown 骨架。
 * 须与 hub Tab、promoteEmbeddedPackFromOutline、story-pro-column-sync 一致。
 */
export const STORY_PRO_PACK_MARKDOWN_STRUCTURE = `# 输出骨架（## 标题字面一致 · GFM 表头不可改）

## 视觉风格总纲

| 维度 | 内容 |
|------|------|
| 故事背景 | （世界观 / 时代背景 / 戏剧空间） |
| 年代/环境定位 | （时代 + 地点 + 季节） |
| 全剧色调基调 | （主色 + HEX） |
| 画面风格 | （如电影级写实） |
| 摄影风格 | （焦段、景深、光比） |
| 日景调色板 | （主色/高光/阴影 HEX，无日景写「—」） |
| 夜景调色板 | （主色/辅光 HEX，无夜景写「—」） |
| 皮肤/材质基调 | （可选 HEX） |
| 建筑风格/置景 | （1–2 句） |
| 光影基调 | （自然光、轮廓光、拒绝平光） |
| 英文风格锚定 | （中文风格锚定优先；非必要不写英文，可 prepend 到生图 prompt） |

## 场景视觉辞典

${STORY_PRO2_SCENE_TABLE_HEADER}

## 核心冲突与结构摘要

| 维度 | 内容 |
|------|------|

## 角色视觉辞典

${STORY_PRO2_CHARACTER_TABLE_HEADER}

## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}

## 下一步交接清单

${STORY_PRO2_HANDOFF_TABLE_HEADER.split("\n")[0] ?? ""}
${STORY_PRO2_HANDOFF_TABLE_HEADER.split("\n")[1] ?? ""}`;

/** 制作包硬性约束（导演模板 / hub 各段共用） */
export const STORY_PRO_PACK_OUTPUT_RULES = `【制作包硬性约束 · 缺一不可 · 影响定稿拆分】
1. 必须输出全部 **## 章节**；禁止用「一、二、三」或纯散文代替；**禁止 Tab 分隔表**，仅 GFM 管道表。
2. 「场景视觉辞典」「角色视觉辞典」「分镜脚本」「下一步交接清单」必须是 **GFM 表格**，表头列名与骨架 **完全一致**。
3. 「核心冲突与结构摘要」须为 **GFM 表**（维度 | 内容 或 项目 | 内容），禁止纯散文代替。
4. 须 **完整保留** 上传剧本中已有场景、人物与对白，只做结构化整理，不得压缩成梗概。
5. 「分镜脚本」须按剧本拆细；**禁止**只输出 3～5 个概括镜头（短片不少于 8 镜，长剧本按场次拆细）。
6. **每镜 9 列均须非空**（景别、运镜、画面描述、对白、时长、AI生图、AI视频、口型/配音）；无对白写「—」。
7. 「对白」列：从剧本 **逐字提取**，格式「角色名：台词」；**禁止**只写在「画面描述」里。
8. 分镜 **角色名** 须与「角色视觉辞典 · 姓名」列 **完全一致**。
9. 「画面描述」每镜须标注 **起始→终止站位**（【起始】…【结束】或 起始/动作/终止）；第 2 镜起 AI 视频列写承接上一镜末尾。
10. 场景表每行须含 **生图关键词(英文)** 与 **固定反向提示词**；角色表每行须含 **AI生图提示词(英文)**。
11. 「下一步交接清单」至少 6 行（序号 | 交接项 | 负责方 | 备注）。
12. 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（机器可读真源）；GFM 须与 JSON 一致。详见 JSON 输出契约。
13. ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}`;

/** 启动节点 · 导演向系统提示词（@ 引用上传剧本 · 界面默认模板） */
export const STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT = `# 角色
你是一位经验丰富的影视剧导演，擅长将文字剧本转化为具体的视听语言。

# 任务
我将给你一份完整的剧本。请你以导演的身份，将其整理为 **可被画布系统自动解析的 Markdown 制作包**，为下一步 AI 生图 / 生视频做好技术准备。

# 输入
@<ref-uploaded-script>
（请在启动节点上传 .md / .txt 剧本；运行时会自动附带全文，无需粘贴）

# 输出要求（严格遵守）

${STORY_PRO_PACK_OUTPUT_RULES}

${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}

${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}

${STORY_PRO2_HANDOFF_TABLE_RULES}

${STORY_PRO_PACK_MARKDOWN_STRUCTURE}

${STORY_PRO2_VIDEO_PROMPT_RULES}

${PRO2_DEFAULT_SHOT_GFM_EXAMPLE}

${PRO2_HANDOFF_EXAMPLE_ROWS}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}

# 注意事项
- ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}
- **AI视频提示词(英文)** 列内写 **中文 Seedance** 提示词（列名不变）。
- 有对白的镜头须在 **口型/配音备注** 标明口型同步或后期配音。
- 优先单人镜头、可控场景数，考虑 AI 生图/生视频可行性。
- 保持全片视觉风格统一。`;

export const STORY_PRO_OUTLINE_USER_PROMPT = `# 任务：故事剧本 · 完整制作包

你将收到 **故事大纲或完整上传剧本**（见上游参考文本）。请以导演视角输出 **完整 Markdown 制作包**，并在末尾附 \`\`\`pro2-production-script\` JSON 围栏。

${STORY_PRO_PACK_OUTPUT_RULES}

# 本段须输出的 ## 章节（顺序一致）
## 视觉风格总纲
${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}
## 场景视觉辞典
${STORY_PRO2_SCENE_TABLE_HEADER}
## 核心冲突与结构摘要
${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}
## 角色视觉辞典
${STORY_PRO2_CHARACTER_TABLE_HEADER}
## 分镜脚本
${STORY_PRO2_STORYBOARD_TABLE_HEADER}
## 下一步交接清单
${STORY_PRO2_HANDOFF_TABLE_RULES}

- **章节标题与表头分行**；禁止标题与表头写在同一行
- **无字数上限**：与上传剧本信息量匹配
- 须同时包含全部章节，各表每行/每镜列均非空`;

export const STORY_PRO_CHARACTER_PROMPT = `# 任务：角色视觉辞典

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据 **上传剧本** 与已生成「视觉风格总纲 / 场景辞典」，输出 **## 角色视觉辞典** 段。

${STORY_PRO_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 角色视觉辞典

${STORY_PRO2_CHARACTER_TABLE_HEADER}

- **必须**输出上表；每行一个主要角色（3~8 行）
- **AI生图提示词(英文)** 列内写 **中文** 生图简报，须完整可直用于三视图/分镜生图（表头含「英文」仅为解析兼容）
- 外貌列供 AI 三视图生图一致性：${THREE_VIEW_APPEARANCE_LLM_RULE_ZH}
- 只输出「## 角色视觉辞典」+ 一张表；末尾附 step=character 的 JSON 围栏`;

export const STORY_PRO_STORYBOARD_PROMPT = `# 任务：分镜脚本表（AI 生图/生视频预备 · 定稿拆分真源）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据上传剧本、风格总纲与角色辞典，将剧本拆解为镜头序列。**禁止只输出 3～5 个概括镜头。**

${STORY_PRO_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}

${STORY_PRO2_VIDEO_PROMPT_RULES}

- 镜号从 1 **连续递增**；时长为整数秒；短片不少于 **8** 镜
- 只输出「## 分镜脚本」+ 一张表；末尾附 step=storyboard 的 JSON 围栏

${PRO2_DEFAULT_SHOT_GFM_EXAMPLE}`;

export function isLegacyStoryProDirectorPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (t.includes(STORY_PRO2_PACK_V7_MARKER)) return false;
  if (t.includes("【制作包硬性约束") && t.includes("AI生图提示词(英文)")) {
    if (t.includes("序号 | 交接项")) return false;
    if (t.includes("环境/时间/气氛")) return false;
  }
  if (t.includes("## 角色视觉辞典") && t.includes("## 分镜脚本")) return false;
  if (/1\.\s*\*\*视觉风格总纲\*\*/.test(t)) return true;
  if (t.includes(STORY_PRO_LEGACY_DIRECTOR_MARK)) return true;
  if (t.includes("【制作包硬性约束") && !t.includes("核心冲突 GFM")) return true;
  if (t.includes("环节 | 说明 | 建议工具/步骤")) return true;
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
