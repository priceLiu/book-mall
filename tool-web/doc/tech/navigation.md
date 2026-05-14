# 左侧菜单结构与扩展规范（tool-web）

工具站左侧导航采用**单一注册表 + 分组渲染**模式。**新增 / 调整菜单只改一个文件**：`config/nav-tools.ts`。

## 1. 数据结构

```ts
// config/nav-tools.ts
export type ToolNavItem = {
  href: string;
  label: string;
  /** 小屏隐藏；true 或省略=显示 */
  showOnMobile?: boolean;
};

export type ToolNavGroup = {
  label: string;          // 顶层显示名（如「试衣间」）
  children: ToolNavItem[]; // 子项；按数组顺序渲染
  defaultOpen?: boolean;  // 没有子项处于激活态时的默认展开状态
};

export type ToolNavEntry = ToolNavItem | ToolNavGroup;
```

- 顶层条目类型 = **`ToolNavEntry`**，可以是「叶子」（`ToolNavItem`）或「分组」（`ToolNavGroup`）。
- 同一组内可以**只有一个子项**，但若该工具不会再扩展，**保持为叶子更整洁**，不要无意义包一层。
- `TOOL_NAV_ITEMS` 是 **`TOOL_NAV_ENTRIES`** 的扁平投影，仅用于 `activeNavHref` 等扁平场景，**不要手工维护**。

## 2. 何时建「分组」

**新增工具时优先并入已有分组**。当某个业务「会持续出现 ≥ 2 个相关子页面」时再建立顶层分组。例如：

- **试衣间**（分组）→ 套装、AI试衣、我的衣柜……（未来还会有「衣橱共享」「试衣记录」等）
- **文生图**（暂时单页）→ 叶子；若以后增加「图生图」「批量生成」再升为分组。

判定原则：

| 条件 | 选择 |
|------|------|
| 单一交互页 | **叶子** |
| ≥ 2 个相关页面 / 计划再加 | **分组** |
| 仅是同一页的弹层 / Tab | **叶子**（弹层不进入菜单） |

## 3. 命名与文案

- **分组名 = 业务名**，避免泛词（如「工具」「服务」）。例：**试衣间**。
- **子项名 = 该业务下的核心动作**。避免重复分组名。例：**套装** / **AI试衣** / **我的衣柜**，而不是「试衣间-套装」。
- 长度：分组名 2–4 字优先，子项名 2–6 字优先；超长时改用更具体的动词短语。

## 4. 默认展开规则

- **`defaultOpen`** 只控制「**未命中子项**」时的初始状态。
- 若当前页面 `pathname` 命中分组内任一子项，该组会被**自动展开**（无视 `defaultOpen`），由 `ToolNavTree` 中的 `useEffect` 强制 open。
- 建议：**与首页直接相关的第一个分组**设 `defaultOpen: true`，其余保持折叠（避免列表过长）。

## 5. 路由与 `toolKey`（费用流水 / 业务打点）

- **不再入库页面浏览**：壳层已移除自动 `page_view` 上报；主站 **`ToolUsageEvent` 仅写入「已标价且扣费金额 > 0」的事件**（试衣成片成功、文生图成功调用等由各工具在服务端调用 **`POST /api/tool-usage`** 代理写入）。
- **`toolKey` 与路径对齐约定**（业务上报时自行换算，与菜单解耦）：`/` → `home`，`/a/b` → `a__b`。
- **不要为分组本身配 `href`**：用户点击分组时只展开，不跳转。
- 子项 `href` 必须是 **绝对路径**，且与 `app/` 路由一致。

## 6. 渲染与交互（参考实现，请勿擅自改协议）

- 渲染入口：**`components/tool-shell-client.tsx`** 内的 `ToolNavTree`。
- 视觉：
  - 顶层叶子 ＝ `.tool-nav-link`（活跃高对比）
  - 分组按钮 ＝ `.tool-nav-group-trigger`，右侧 `.tool-nav-chevron`（`0deg` ↔ `90deg`，过渡 ~220ms）
  - 子项 ＝ `.tool-nav-sublink`，左侧 `.tool-nav-sublink-dot` + 引导竖线（`.tool-nav-sublist::before`），hover 整行右移 2px
  - 折叠面板 ＝ `.tool-nav-group-panel` 用 `max-height + opacity` 过渡（默认上限 **480px**；如某组子项即将逼近，需在 `globals.css` 调大）
- 可访问性：
  - 分组按钮带 `aria-expanded`；子项保留为 `<Link>` 以便键盘 / 屏幕阅读器顺序访问。
  - 移动端打开侧栏抽屉后，点击子项会自动关闭（`onNavigate` 回调）。

## 7. `showOnMobile: false`

- 若某子项只在桌面有意义（例如复杂表格预览），保留 `showOnMobile: false` 并在 **`tech/layout-and-responsive.md`** 写明桌面独占的理由；移动端将自动隐藏（`.tool-nav-li--desktop-only`）。

## 8. 验证清单（PR 前）

- [ ] 新菜单项已加入 `TOOL_NAV_ENTRIES`，并选择了合理的分组 / 叶子。
- [ ] 子项 `href` 与 `app/` 实际路由一致，刷新不会 404。
- [ ] 命中子项时该分组能被自动展开。
- [ ] 桌面 / 移动端均可点击（除非 `showOnMobile: false` 并已写文档）。
- [ ] **「实现逻辑」页**已按 **`product/tools-delivery-checklist.md`** §5 交付（路由、导航、`ToolImplementationCrossLink`、摘录与页脚文案）。

## 9. 范例：本期改造

```ts
export const TOOL_NAV_ENTRIES: ToolNavEntry[] = [
  {
    label: "试衣间",
    navKey: "fitting-room",
    defaultOpen: true,
    children: [
      { href: "/fitting-room", label: "套装" },
      { href: "/fitting-room/ai-fit", label: "AI智能试衣" },
      { href: "/fitting-room/ai-fit/closet", label: "我的衣柜" },
      { href: "/fitting-room/implementation", label: "实现逻辑 · 套装" },
      { href: "/fitting-room/ai-fit/implementation", label: "实现逻辑 · AI智能试衣" },
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
    label: "图生视频",
    navKey: "image-to-video",
    defaultOpen: true,
    children: [
      { href: "/image-to-video", label: "首页" },
      { href: "/image-to-video/lab", label: "实验室" },
      { href: "/image-to-video/library", label: "我的视频库" },
      { href: "/image-to-video/implementation", label: "实现逻辑" },
    ],
  },
  {
    label: "视觉实验室",
    navKey: "visual-lab",
    defaultOpen: true,
    children: [
      { href: "/visual-lab", label: "首页" },
      { href: "/visual-lab/analysis", label: "分析室" },
      { href: "/visual-lab/gallery", label: "成果展" },
      { href: "/visual-lab/implementation", label: "实现逻辑" },
    ],
  },
  {
    label: "AI智能客服",
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
      { href: "/app-history/price-list", label: "价格表", navKey: "app-history" },
      {
        href: "/app-history/plan-rules",
        label: "计费规则说明",
        navKey: "app-history",
      },
    ],
  },
];
```

实现逻辑页须满足 **`product/tools-delivery-checklist.md`** §5。
