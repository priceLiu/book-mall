/** 将打点 toolKey 翻译成与左侧菜单一致的人类可读名称。 */
export function toolKeyToLabel(toolKey: string): string {
  const key = toolKey.trim();
  if (!key) return "—";
  const exact: Record<string, string> = {
    home: "工作台",
    "fitting-room": "试衣间",
    "fitting-room__ai-fit": "AI试衣",
    "fitting-room__ai-fit__closet": "我的衣柜",
    "text-to-image": "文生图",
    "app-history": "应用历史",
  };
  if (exact[key]) return exact[key];
  if (key.startsWith("fitting-room__ai-fit__closet")) return "我的衣柜";
  if (key.startsWith("fitting-room__ai-fit")) return "AI试衣";
  if (key.startsWith("fitting-room")) return "试衣间";
  if (key.startsWith("text-to-image")) return "文生图";
  if (key.startsWith("app-history")) return "应用历史";
  return key;
}
