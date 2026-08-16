/** 我的 AI 空间 · 页内 Tab（用 ?tab= 切换，各 Tab 数据服务端按需加载） */
export const AI_SPACE_TABS = [
  { id: "wall", label: "作品墙" },
  { id: "digital-humans", label: "数字人库" },
  { id: "audio", label: "音频库" },
  { id: "favorites", label: "我的收藏" },
  { id: "videos", label: "视频创作库" },
  { id: "broadcast", label: "口播脚本" },
  { id: "compose", label: "合成台" },
  { id: "compose-tasks", label: "合成任务" },
] as const;

export type AiSpaceTabId = (typeof AI_SPACE_TABS)[number]["id"];

export const AI_SPACE_TAB_DESCRIPTIONS: Record<AiSpaceTabId, string> = {
  wall: "各应用已发布的作品在此布置展示。空间只保存指向原作品的链接，不复制文件；删除原作品会一并移除这里的展示。",
  "digital-humans":
    "数字人形象的平台真源。上传形象后，电商、画布、Story 等应用都能直接引用同一条记录。",
  audio:
    "平台统一音频库。快速复刻生成的音频会自动汇入这里，也可直接上传或用 Gateway 模型生成口播。",
  favorites:
    "收藏的个人音频、数字人形象与 TTS 音色；合成台可优先从收藏中选材。",
  videos: "可用于合成的背景与素材视频。各应用视频经作品墙引用展示，自拍与合成成片存在本库。",
  compose: "数字人口播合成：选形象 + 选音频 + 选背景，经 Gateway 生成口播视频后叠加为成片。",
  "compose-tasks":
    "查看数字人口播合成任务列表与分步进度；失败可重试，完成可预览成片并展示到作品墙。",
  broadcast: "口播分镜脚本：整段文案 AI 拆镜，表格编辑后锁定，按镜渲染并拼接成片。",
};

export function normalizeAiSpaceTab(raw: unknown): AiSpaceTabId {
  return AI_SPACE_TABS.some((t) => t.id === raw) ? (raw as AiSpaceTabId) : "wall";
}
