/** 左侧工具导航：支持「分组」与「叶子」两类节点。新增工具时优先放进已有分组。 */
export type ToolNavItem = {
  href: string;
  label: string;
  /** 若为 false，小屏隐藏该项 */
  showOnMobile?: boolean;
  /**
   * 与主站 `ToolNavVisibility.navKey` 对应；省略时按 href 首段推导。
   * 菜单是否在侧栏展示由主站后台「工具管理」控制。
   */
  navKey?: string;
};

export type ToolNavGroup = {
  label: string;
  /** 整组菜单在主站的 visibility key（必填），与 tool-web/config/nav-tools 文档约定一致 */
  navKey: string;
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
    navKey: "fitting-room",
    defaultOpen: true,
    children: [
      { href: "/fitting-room", label: "套装" },
      { href: "/fitting-room/ai-fit", label: "AI试衣" },
      { href: "/fitting-room/ai-fit/closet", label: "我的衣柜" },
      { href: "/fitting-room/implementation", label: "实现逻辑 · 套装" },
      { href: "/fitting-room/ai-fit/implementation", label: "实现逻辑 · AI试衣" },
    ],
  },
  {
    label: "文生图",
    navKey: "text-to-image",
    defaultOpen: true,
    children: [
      { href: "/text-to-image", label: "生成" },
      { href: "/text-to-image/library", label: "我的图片库" },
      { href: "/text-to-image/implementation", label: "实现逻辑" },
    ],
  },
  {
    label: "智能客服",
    navKey: "smart-support",
    defaultOpen: true,
    children: [
      { href: "/smart-support", label: "首页" },
      { href: "/smart-support/chat", label: "我的智能客服" },
      { href: "/smart-support/implementation", label: "实现逻辑" },
    ],
  },
  {
    label: "费用",
    navKey: "app-history",
    defaultOpen: true,
    children: [
      { href: "/app-history", label: "费用使用明细", navKey: "app-history" },
      {
        href: "/app-history/plan-rules",
        label: "计费规则说明",
        navKey: "app-history",
      },
    ],
  },
];

/** 仅供 activeNavHref 等扁平场景使用 */
export const TOOL_NAV_ITEMS: ToolNavItem[] = TOOL_NAV_ENTRIES.flatMap((e) =>
  isToolNavGroup(e) ? e.children : [e],
);
