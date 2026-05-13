export type AppHistoryTabId =
  | "all"
  | "fitting"
  | "ai_fit"
  | "closet"
  | "text_to_image";

export type AppHistoryTabDef = {
  id: AppHistoryTabId;
  label: string;
};

/** 与左侧菜单对应的查看维度（按打点 toolKey 过滤）。 */
export const APP_HISTORY_TAB_DEFS: AppHistoryTabDef[] = [
  { id: "all", label: "全部" },
  { id: "fitting", label: "试衣间" },
  { id: "ai_fit", label: "AI智能试衣" },
  { id: "closet", label: "我的衣柜" },
  { id: "text_to_image", label: "文生图" },
];

export function usageEventMatchesTab(
  tabId: AppHistoryTabId,
  toolKey: string,
): boolean {
  if (tabId === "all") return true;
  if (tabId === "fitting") {
    return (
      toolKey === "fitting-room" ||
      (toolKey.startsWith("fitting-room") &&
        !toolKey.includes("ai-fit") &&
        !toolKey.includes("closet"))
    );
  }
  if (tabId === "ai_fit") {
    return toolKey.includes("ai-fit") && !toolKey.includes("closet");
  }
  if (tabId === "closet") {
    return toolKey.includes("closet");
  }
  if (tabId === "text_to_image") {
    return (
      toolKey.includes("text-to-image") || toolKey.includes("text_to_image")
    );
  }
  return true;
}
