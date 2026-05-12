/** 左侧工具导航：支持「分组」与「叶子」两类节点。新增工具时优先放进已有分组。 */
export type ToolNavItem = {
  href: string;
  label: string;
  /** 若为 false，小屏隐藏该项 */
  showOnMobile?: boolean;
};

export type ToolNavGroup = {
  label: string;
  /** 子项；按从上到下顺序渲染 */
  children: ToolNavItem[];
  /** 当组内没有任一活跃路径时的默认展开状态；默认 false（折叠） */
  defaultOpen?: boolean;
};

export type ToolNavEntry = ToolNavItem | ToolNavGroup;

export function isToolNavGroup(e: ToolNavEntry): e is ToolNavGroup {
  return Array.isArray((e as ToolNavGroup).children);
}

export const TOOL_NAV_ENTRIES: ToolNavEntry[] = [
  {
    label: "试衣间",
    defaultOpen: true,
    children: [
      { href: "/fitting-room", label: "套装" },
      { href: "/fitting-room/ai-fit", label: "AI试衣" },
      { href: "/fitting-room/ai-fit/closet", label: "我的衣柜" },
    ],
  },
  { href: "/text-to-image", label: "文生图" },
  { href: "/app-history", label: "应用历史" },
];

/** 仅供 activeNavHref 等扁平场景使用 */
export const TOOL_NAV_ITEMS: ToolNavItem[] = TOOL_NAV_ENTRIES.flatMap((e) =>
  isToolNavGroup(e) ? e.children : [e],
);
