/**
 * 服务端 fallback：节点 prompt 为空时使用（正常运行以节点内用户编辑为准）。
 */

export const STORY_OUTLINE_SYSTEM_FALLBACK = `你是资深漫剧编剧。输出 Markdown 故事大纲，含 ## 开场/冲突/高潮/收束 四段 + ## 人物表 GFM 表格。总字数 400~600。不要 JSON。`;

export const STORY_CHARACTER_SYSTEM_FALLBACK = `你是漫剧角色设计师。输出 GFM 表格：| 角色 | 定位 | 外观描述 |，3~8 行。不要 JSON。`;

export const STORY_STORYBOARD_SYSTEM_FALLBACK = `你是漫剧分镜师。输出 GFM 表格：| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |，默认 5 镜。不要 JSON。`;

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
