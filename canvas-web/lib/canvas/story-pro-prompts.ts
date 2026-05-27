/** 影视专业版 · LLM / 风格 / 可行性 prompt */

export {
  STORY_PRO_PACK_PROMPT_VERSION,
  STORY_PRO_LEGACY_DIRECTOR_MARK,
  STORY_PRO_PACK_MARKDOWN_STRUCTURE,
  STORY_PRO_PACK_OUTPUT_RULES,
  STORY_PRO_DIRECTOR_FROM_SCRIPT_PROMPT,
  STORY_PRO_OUTLINE_USER_PROMPT,
  STORY_PRO_CHARACTER_PROMPT,
  STORY_PRO_STORYBOARD_PROMPT,
  isLegacyStoryProDirectorPrompt,
  storyProHubDefaultPromptPack,
} from "./story-pro-script-pack";

export {
  STORY_PRO_PLANNER_SYSTEM_PREFIX,
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
  STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT,
  STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES,
  type StoryProThemeSystemPromptTemplateId,
} from "./story-pro-theme-templates";

export const STORY_PRO_STYLE_DRAFT_SYSTEM = `你是视觉导演。根据剧本题材与基调，输出 JSON：
{
  "mainStyle": "anime|american-comic|webtoon|chibi|cg|photorealistic|game-cg|chinese-3d|other",
  "colorTone": "bright-warm|dark-moody|vivid|soft|high-contrast",
  "renderQuality": "flat|thick-paint|watercolor|oil",
  "styleAnchorZh": "中文风格锚定段落",
  "styleAnchorEn": "English style anchor paragraph",
  "negativePrompt": "comma separated negatives"
}`;

export const STORY_PRO_FEASIBILITY_SYSTEM = `评估剧本 AI 生成可行性，输出 JSON：
{ "items": [{ "id": "...", "label": "...", "level": "low|medium|high", "note": "..." }], "highRiskCount": number }`;

export const STORY_PRO_FRAME_IMAGE_PROMPT_DEFAULT = ` cinematic storyboard frame, consistent character, `;

export const STORY_PRO_VIDEO_PROMPT_DEFAULT = ` subtle camera motion, natural lighting, `;

export function buildStoryProClientPage(projectId: string): string {
  return `canvas/${projectId}/story-pro`;
}
