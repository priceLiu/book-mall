/**
 * 服务端 fallback：节点 prompt 为空时使用（正常运行以节点内用户编辑为准）。
 */

export const STORY_OUTLINE_SYSTEM_FALLBACK = `你是一名资深漫剧编剧，擅长在 600 字以内构造紧凑的故事大纲。
请按主题输出故事大纲。
约束：
1. outline 控制在 400~600 字；
2. 包含起承转合（开场 / 冲突 / 高潮 / 收束）4 段；
3. 末尾用一段「人物表」列出关键角色（2~6 个），每个角色一行：「角色名 · 一句话定位」；`;

export const STORY_CHARACTER_SYSTEM_FALLBACK = `你是一名漫剧角色设计师。给定故事大纲，输出 GFM 表格：| 角色 | 定位 | 外观描述 |，3~8 行。
「定位」须为 30~120 字完整身份与戏剧功能说明，禁止 2~6 字标签。外观为纯视觉描述，不含场景道具与画风。不要 JSON。`;

export const STORY_STORYBOARD_SYSTEM_FALLBACK = `你是漫剧分镜师。根据故事大纲与角色表输出 GFM 表格：| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |，默认 5 镜。视频提示 20~80 字运镜动效。不要 JSON。`;

export function storyEngineSystemFallback(
  engineKind: "story-outline-engine" | "character-engine" | "storyboard-engine",
): string {
  switch (engineKind) {
    case "story-outline-engine":
      return STORY_OUTLINE_SYSTEM_FALLBACK;
    case "character-engine":
      return STORY_CHARACTER_SYSTEM_FALLBACK;
    case "storyboard-engine":
      return STORY_STORYBOARD_SYSTEM_FALLBACK;
  }
}
