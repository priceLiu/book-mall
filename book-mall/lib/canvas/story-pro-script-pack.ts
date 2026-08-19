/**
 * 影视专业版 · 故事剧本制作包 prompt 组装（上传剧本 · LLM 输出结构 · 定稿拆分）
 * 规则真源：data/pro2-production-pack-standard.ts · docs/大模型剧本提示词.md
 * book-mall/lib/canvas/story-pro-script-pack.ts 须保持同步
 */
import {
  PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
  PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_DEFAULT_SHOT_GFM_EXAMPLE,
  PRO2_HANDOFF_EXAMPLE_ROWS,
  PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES,
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_MARKDOWN_STRUCTURE,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_V7_MARKER,
  STORY_PRO2_PACK_V8_MARKER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6,
} from "./data/pro2-production-pack-standard";
import { THREE_VIEW_APPEARANCE_LLM_RULE_ZH } from "./three-view-prompt-rules";

/** 加载画布时低于此版本则刷新「导演·上传剧本」与 hub 段 prompt */
export const STORY_PRO_PACK_PROMPT_VERSION = 7;

/** @deprecated 旧版导演模板指纹 */
export const STORY_PRO_LEGACY_DIRECTOR_MARK = "角色与场景视觉辞典";

export {
  STORY_PRO2_PACK_MARKDOWN_STRUCTURE as STORY_PRO_PACK_MARKDOWN_STRUCTURE,
  STORY_PRO2_PACK_OUTPUT_RULES as STORY_PRO_PACK_OUTPUT_RULES,
};

/** 启动节点 · 导演向系统提示词（@ 引用上传剧本 · 界面默认模板） */
export const STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT = `# 角色
你是一位经验丰富的影视剧导演，擅长将文字剧本转化为具体的视听语言。

# 任务
我将给你一份完整的剧本。请你以导演的身份，将其整理为 **可被画布系统自动解析的 Markdown 制作包**，为下一步 AI 生图 / 生视频做好技术准备。

# 输入
@<ref-uploaded-script>
（请在启动节点上传 .md / .txt 剧本；运行时会自动附带全文，无需粘贴）

# 输出要求（严格遵守 · ${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_OUTPUT_RULES}

${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}

${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}

${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}

${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}

${PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES}

${STORY_PRO2_HANDOFF_TABLE_RULES}

${STORY_PRO2_PACK_MARKDOWN_STRUCTURE}

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

${PRO2_DEFAULT_SHOT_GFM_EXAMPLE}

${PRO2_HANDOFF_EXAMPLE_ROWS}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}

# 注意事项
- ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}
- 分镜图/分镜视频提示词由 Hub **Pass2「生成提示词」** 完成，Pass1 勿写 AI 列。
- 有对白的镜头须在 **口型/配音备注** 标明口型同步或后期配音。
- 保持全片视觉风格统一；所有生图提示词末尾追加 \`[视觉风格：…]\`。`;

export const STORY_PRO_OUTLINE_USER_PROMPT = `# 任务：故事剧本 · 完整制作包（${STORY_PRO2_PACK_V8_MARKER}）

你将收到 **故事大纲或完整上传剧本**（见上游参考文本）。请以导演视角输出 **完整 Markdown 制作包**，并在末尾附 \`\`\`pro2-production-script\` JSON 围栏（step=full_pack · schemaVersion=2）。

${STORY_PRO2_PACK_OUTPUT_RULES}

# 本段须输出的 ## 章节（顺序一致）
## 视觉风格总纲
${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}
## 场景视觉辞典
${STORY_PRO2_SCENE_TABLE_HEADER}
${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}
## 核心冲突与结构摘要
${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}
## 角色视觉辞典
${STORY_PRO2_CHARACTER_TABLE_HEADER}
${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}
## 道具视觉辞典
${PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES}
## 分镜脚本
${STORY_PRO2_STORYBOARD_TABLE_HEADER}
${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}
## 下一步交接清单
${STORY_PRO2_HANDOFF_TABLE_RULES}

- **章节标题与表头分行**；禁止标题与表头写在同一行
- 须同时包含全部章节（含道具视觉辞典），各表每行/每镜列均非空
- JSON patch 须含 meta · visualStyle · coreConflict · scenes · characters · props · shots · handoff

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const STORY_PRO_CHARACTER_PROMPT = `# 任务：角色视觉辞典（${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据 **上传剧本** 与已生成「视觉风格总纲 / 场景辞典」，输出 **## 角色视觉辞典** 段。

${STORY_PRO2_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 角色视觉辞典

${STORY_PRO2_CHARACTER_TABLE_HEADER}

${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}

- **必须**输出上表；每行一个主要角色（3~8 行）
- 外貌列供 AI 三视图生图一致性：${THREE_VIEW_APPEARANCE_LLM_RULE_ZH}
- 只输出「## 角色视觉辞典」+ 一张表；末尾附 step=character 的 JSON 围栏`;

export const STORY_PRO_STORYBOARD_PROMPT = `# 任务：分镜脚本表（Pass1 导演表 · ${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据上传剧本、风格总纲、角色/道具辞典，将剧本拆解为镜头序列。**须 12–18 镜，总时长 175–185 秒。**

${STORY_PRO2_PACK_OUTPUT_RULES}

# 输出格式（表头列名不可改）
## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

- Pass1 **禁止** AI生图/AI视频 列；只输出「## 分镜脚本」+ 一张 10 列表；末尾附 step=storyboard · schemaVersion 2 的 JSON 围栏

${PRO2_DEFAULT_SHOT_GFM_EXAMPLE}`;

export function isLegacyStoryProDirectorPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (t.includes(STORY_PRO2_PACK_V8_MARKER)) return false;
  if (t.includes("道具视觉辞典") && t.includes("12–18 镜")) return false;
  if (t.includes(STORY_PRO2_PACK_V7_MARKER) && !t.includes(STORY_PRO2_PACK_V8_MARKER)) {
    return true;
  }
  if (t.includes("每镜 9 列") || t.includes("AI生图、AI视频")) return true;
  if (t.includes("【制作包硬性约束") && t.includes("AI生图提示词(英文)")) {
    if (!t.includes("道具六视图")) return true;
  }
  if (/1\.\s*\*\*视觉风格总纲\*\*/.test(t)) return true;
  if (t.includes(STORY_PRO_LEGACY_DIRECTOR_MARK)) return true;
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
