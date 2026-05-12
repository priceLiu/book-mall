/** 左侧「工具列表」注册表：新增工具时在此追加一项即可。 */
export type ToolNavItem = {
  href: string;
  label: string;
  /** 若为 false，小屏隐藏该项（需在 doc 中说明原因） */
  showOnMobile?: boolean;
};

export const TOOL_NAV_ITEMS: ToolNavItem[] = [
  { href: "/fitting-room", label: "试衣间" },
  { href: "/fitting-room/ai-fit", label: "AI试衣" },
  { href: "/fitting-room/ai-fit/closet", label: "我的衣柜" },
  { href: "/text-to-image", label: "文生图" },
];
