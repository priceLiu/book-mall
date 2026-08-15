/** 我的 AI 空间 · 页内 Tab（用 ?tab= 切换，各 Tab 数据服务端按需加载） */
export const AI_SPACE_TABS = [
  { id: "wall", label: "作品墙" },
  { id: "digital-humans", label: "数字人库" },
  { id: "audio", label: "音频库" },
  { id: "videos", label: "视频创作库" },
  { id: "compose", label: "合成台" },
] as const;

export type AiSpaceTabId = (typeof AI_SPACE_TABS)[number]["id"];

export function normalizeAiSpaceTab(raw: unknown): AiSpaceTabId {
  return AI_SPACE_TABS.some((t) => t.id === raw) ? (raw as AiSpaceTabId) : "wall";
}
