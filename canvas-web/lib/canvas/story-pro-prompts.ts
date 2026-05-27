/** 影视专业版 · LLM / 风格 / 可行性 prompt */

export const STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT = `你是影视级 AI 漫剧总策划。输出须结构化、可执行，并考虑 AI 生图/生视频的可行性（优先单人镜头、可控场景数）。`;

export const STORY_PRO_OUTLINE_USER_PROMPT = `根据主题生成故事大纲 Markdown，含：核心冲突、主要角色、场景列表（标注室内/室外）、预估镜头难度（低/中/高）。`;

export const STORY_PRO_CHARACTER_PROMPT = `根据大纲生成角色表 Markdown 表格：姓名、身份、外貌关键词、性格。`;

export const STORY_PRO_STORYBOARD_PROMPT = `根据大纲生成分镜表 Markdown：镜号、景别、运镜、画面描述、对白、时长(秒)、AI难度(1-5)。`;

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
