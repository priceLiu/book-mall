/** 工具站 toolKey → 人类可读名（与 tool-web/lib/tool-key-label.ts 保持一致）。 */
export function toolKeyToLabel(toolKey: string): string {
  const key = toolKey.trim();
  if (!key) return "—";
  const exact: Record<string, string> = {
    home: "工作台",
    "fitting-room": "试衣间",
    "fitting-room__ai-fit": "AI智能试衣",
    "fitting-room__ai-fit__closet": "我的衣柜",
    "text-to-image": "文生图",
    "text-to-image__library": "我的图片库",
    "image-to-video": "图生视频",
    "image-to-video__library": "我的视频库",
    "visual-lab": "视觉实验室",
    "visual-lab__analysis": "视觉实验室 · 分析室",
    "story-theater": "漫剧剧场",
    "story-theater__creator": "漫剧剧场 · 创作幻想家",
    "story-theater__library": "我的剧场",
    "app-history": "费用使用明细",
    "canvas__story-pro__parse-outfit": "画布·角色资产·服装分割",
    "canvas__story-pro": "画布·影视专业版",
    canvas: "画布",
  };
  if (exact[key]) return exact[key];
  if (key.startsWith("fitting-room__ai-fit__closet")) return "我的衣柜";
  if (key.startsWith("fitting-room__ai-fit")) return "AI智能试衣";
  if (key.startsWith("fitting-room")) return "试衣间";
  if (key.startsWith("text-to-image__library")) return "我的图片库";
  if (key.startsWith("text-to-image")) return "文生图";
  if (key.startsWith("image-to-video__library")) return "我的视频库";
  if (key.startsWith("image-to-video")) return "图生视频";
  if (key.startsWith("visual-lab")) return "视觉实验室";
  if (key.startsWith("story-theater")) return "漫剧剧场";
  if (key.startsWith("canvas__story-pro__parse-outfit")) return "画布·角色资产·服装分割";
  if (key.startsWith("canvas__story-pro")) return "画布·影视专业版";
  if (key.endsWith("__sbv1")) return "画布·分镜视频1.0";
  if (key.startsWith("canvas")) return "画布";
  if (key.startsWith("app-history")) return "费用使用明细";
  return key;
}
