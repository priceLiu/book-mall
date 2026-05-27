/**
 * 影视专业版 · 启动页创意模板。
 * 默认示例源自 YubAI-DramaFlow examples/获得异能的那一天，我和校花成为了同桌/故事大纲.md
 */
import { STORY_PRO_YUBAI_CAMPUS_ABILITY_OUTLINE_MD } from "./data/story-pro-yubai-campus-ability-outline";
import { STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT } from "./story-pro-script-pack";

export const STORY_PRO_PLANNER_SYSTEM_PREFIX = `你是影视级 AI 漫剧总策划。输出须结构化、可执行，并考虑 AI 生图/生视频的可行性（优先单人镜头、可控场景数）。`;

/** 故事剧本 hub · LLM system（短指令；完整创意参考经上游 textInputs 传入 user） */
export const STORY_PRO_HUB_LLM_SYSTEM = STORY_PRO_PLANNER_SYSTEM_PREFIX;

/** 影视专业版 LLM 默认参数：参考包较长，提高 max_tokens 避免截断 */
export const STORY_PRO_LLM_PARAMS_DEFAULT = {
  reasoning_effort: "low" as const,
  max_tokens: 16000,
  temperature: 0.7,
};

export function wrapStoryProThemeOutline(outlineMd: string): string {
  const body = outlineMd.trim();
  if (!body) return STORY_PRO_PLANNER_SYSTEM_PREFIX;
  return `${STORY_PRO_PLANNER_SYSTEM_PREFIX}

以下是本次创作的创意参考包（已含世界观、人物、分集与场景级剧本）。**须完整保留参考包中已写明的场景、对白与镜头描述**，仅做影视化结构化整理：

---

${body}`;
}

export const STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES = [
  {
    id: "director-from-script",
    label: "导演 · 上传剧本",
    description:
      "上传剧本 @ 引用 → 结构化制作包（含角色表+分镜表+对白列，供定稿拆分）",
    content: STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT,
  },
  {
    id: "yubai-campus-ability",
    label: "示例 · 校园异能",
    description:
      "获得异能的那一天，我和校花成为了同桌（YubAI 示例故事大纲）",
    content: wrapStoryProThemeOutline(STORY_PRO_YUBAI_CAMPUS_ABILITY_OUTLINE_MD),
  },
  {
    id: "blank-planner",
    label: "空白 · 总策划",
    description: "仅总策划指令，自行填写创意参考",
    content: STORY_PRO_PLANNER_SYSTEM_PREFIX,
  },
] as const;

export type StoryProThemeSystemPromptTemplateId =
  (typeof STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES)[number]["id"];

export function storyProThemeSystemPromptForTemplate(
  id: StoryProThemeSystemPromptTemplateId,
): string {
  const hit = STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES.find((t) => t.id === id);
  return hit?.content ?? STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES[0].content;
}

export function matchStoryProThemeSystemPromptTemplateId(
  systemPrompt: string,
): StoryProThemeSystemPromptTemplateId | undefined {
  const t = systemPrompt.trim();
  if (!t) return undefined;
  for (const tpl of STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES) {
    if (t === tpl.content.trim()) return tpl.id;
  }
  return undefined;
}

/** 新建 story-pro-starter / 影视专业版模板图默认加载的创意包 */
export const STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT =
  storyProThemeSystemPromptForTemplate("director-from-script");

export { STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT };
