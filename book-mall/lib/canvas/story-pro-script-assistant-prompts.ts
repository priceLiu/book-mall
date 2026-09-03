import {
  PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
  PRO2_CHARACTER_APPEARANCE_COLUMN_RULES,
  PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES,
  PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES,
  STORY_PRO2_CORE_CONFLICT_TABLE_RULES,
  STORY_PRO2_HANDOFF_TABLE_RULES,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_PARSE_CONTRACT,
  STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6,
} from "@/lib/canvas/data/pro2-production-pack-standard";

export type ScriptAssistantOutputMode = "chat" | "pack";

export function parseScriptAssistantOutputMode(
  raw: unknown,
): ScriptAssistantOutputMode {
  return raw === "pack" ? "pack" : "chat";
}

export function buildScriptAssistantSystemPrompt(
  mode: ScriptAssistantOutputMode,
): string {
  const base = `你是「剧本创作助手」，服务于影视专业版 AI 短剧画布。
帮助用户撰写、润色、扩写剧本、故事大纲、角色设定与分镜脚本。
语气专业、简洁；默认简体中文。`;

  if (mode === "chat") {
    return `${base}

【当前模式：闲聊 / 润色】
- 可使用自由 Markdown、散文、提纲、片段对白；**不必**输出完整影视制作包。
- 可讨论创意、改台词、扩写单场戏；表格式内容仅在与用户问题相关时出现。
- 若用户明确要求「导入画布」「完整制作包」「按分镜表导出」，请提醒其将模式切换为「创作并导入故事剧本」，或在回复末尾说明：切换到该模式后可再生成一版结构化全文。`;
  }

  return `${base}

【当前模式：创作并导入故事剧本 · 完整制作包 · JSON-only v13】
用户将把结果导入影视专业版 2.0 Hub。你必须 **只输出** 一个 \`\`\`pro2-production-script\` JSON 围栏（step=full_pack · tier=pro），单次回复即全文，勿只给摘要。

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

- **禁止** Markdown 章节、GFM 表、围栏外说明文字。
- Pass2 frameImagePrompt / videoPrompt 由 Hub「生成提示词」完成；Pass1 shots[] 禁止 imagePrompt / videoPrompt。`;
}
