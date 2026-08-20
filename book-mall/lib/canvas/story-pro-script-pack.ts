/**
 * 影视专业版 · 故事剧本制作包 prompt 组装（上传剧本 · LLM 输出结构 · 定稿拆分）
 * 规则真源：data/pro2-production-pack-standard.ts · docs/大模型剧本提示词.md
 * book-mall/lib/canvas/story-pro-script-pack.ts 须保持同步
 */
import {
  PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
  PRO2_CHARACTER_APPEARANCE_COLUMN_RULES,
  PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_ONLY_MARKER,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_PARSE_CONTRACT,
  STORY_PRO2_PACK_V7_MARKER,
  STORY_PRO2_PACK_V8_MARKER,
  STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6,
} from "./data/pro2-production-pack-standard";

/** 加载画布时低于此版本则刷新「导演·上传剧本」与 hub 段 prompt */
export const STORY_PRO_PACK_PROMPT_VERSION = 7;

/** @deprecated 旧版导演模板指纹 */
export const STORY_PRO_LEGACY_DIRECTOR_MARK = "角色与场景视觉辞典";

export {
  STORY_PRO2_PACK_OUTPUT_RULES as STORY_PRO_PACK_OUTPUT_RULES,
};

/** 启动节点 · 导演向系统提示词（@ 引用上传剧本 · JSON-only v13） */
export const STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT = `# 角色
你是一位经验丰富的影视剧导演，擅长将文字剧本转化为具体的视听语言。

# 任务
我将给你一份完整的剧本。请 **只输出** \`\`\`pro2-production-script\` JSON 围栏（step=full_pack · schemaVersion=2），**禁止** Markdown/GFM。

# 输入
@<ref-uploaded-script>

${STORY_PRO2_PACK_PARSE_CONTRACT}

${STORY_PRO2_PACK_OUTPUT_RULES}

${STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6}

${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}

${STORY_PRO2_CORE_CONFLICT_TABLE_RULES}

${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}

${PRO2_CHARACTER_APPEARANCE_COLUMN_RULES}

${PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES}

${STORY_PRO2_HANDOFF_TABLE_RULES}

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}

# 注意事项
- ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}
- Pass2 frameImagePrompt / videoPrompt 由 Hub「生成提示词」完成。
- 所有 imagePrompt 末尾追加 \`[视觉风格：…]\`。`;

export const STORY_PRO_OUTLINE_USER_PROMPT = `# 任务：故事剧本 · 完整制作包 · JSON-only v13（${STORY_PRO2_PACK_V8_MARKER}）

你将收到 **故事大纲或完整上传剧本**。请 **只输出** \`\`\`pro2-production-script\` JSON（step=full_pack · tier=pro · schemaVersion=2）。

${STORY_PRO2_PACK_OUTPUT_RULES}

${PRO2_CHARACTER_APPEARANCE_COLUMN_RULES}
${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}
${PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES}
${PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES}
${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}
${STORY_PRO2_HANDOFF_TABLE_RULES}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const STORY_PRO_CHARACTER_PROMPT = `# 任务：角色视觉辞典 · JSON-only（step=character · ${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据 **上传剧本** 与 visualStyle / scenes，输出 JSON patch.characters[]。

${STORY_PRO2_PACK_OUTPUT_RULES}

${PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES}

${PRO2_CHARACTER_APPEARANCE_COLUMN_RULES}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const STORY_PRO_STORYBOARD_PROMPT = `# 任务：分镜脚本 Pass1 · JSON-only（step=storyboard · ${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_LANGUAGE_RULES}

根据上传剧本拆解镜头序列。**须 12–18 镜，总时长 175–185 秒。**

${STORY_PRO2_PACK_OUTPUT_RULES}

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

- JSON shots[] **禁止** imagePrompt / videoPrompt / frameImagePrompt

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

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
