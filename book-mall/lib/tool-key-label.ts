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
    "app-history": "费用使用明细",
  };
  if (exact[key]) return exact[key];
  if (key.startsWith("fitting-room__ai-fit__closet")) return "我的衣柜";
  if (key.startsWith("fitting-room__ai-fit")) return "AI智能试衣";
  if (key.startsWith("fitting-room")) return "试衣间";
  if (key.startsWith("text-to-image__library")) return "我的图片库";
  if (key.startsWith("text-to-image")) return "文生图";
  if (key.startsWith("app-history")) return "费用使用明细";
  return key;
}
