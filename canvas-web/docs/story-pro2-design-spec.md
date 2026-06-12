# 影视专业版 2.0 · UI 设计规范

> **真源常量**：`lib/canvas/story-pro2-node-chrome.ts`  
> **配色分流（列组件）**：`lib/canvas/story-edition-chrome.ts` · `edition: "pro2"`  
> **关联**：[`plan-2.0.md`](./plan-2.0.md) · [`story-pro2-workflow-canonical.md`](./story-pro2-workflow-canonical.md)

---

## 1. 设计原则

1. **与 1.0 专业版（青色）、漫剧（橙色）、绿色助手 UI 完全隔离**  
2. **2.0 全站只用紫罗兰系**（`#a78bfa` / `violet-*`），**禁止** `emerald` / `green` / 1.0 `cyan` 出现在 pro2 画布、浮动检视、剧本助手（pro2 画布时）  
3. **薄卡只展示标题 + 状态徽标**；有标题则**不写副标题/描述行**（详情在下方浮动检视内）  
4. **浮动检视**锚定在节点底边正中；样式与薄卡同系（圆角、描边、标题栏）  
5. 对话框一律 `useDialogs()`，禁止原生弹窗  

---

## 2. 色彩

| 用途 | 值 / Tailwind |
| --- | --- |
| 主强调 | `#a78bfa` · `PRO2_NODE_ACCENT` |
| 浅底 / hover | `rgba(167,139,250,0.14)` · `violet-500/15` |
| 描边 | `rgba(167,139,250,0.38)` · `border-violet-400/30`～`/45` |
| 标题字 | `text-violet-100` |
| 次要字 | `text-white/55`（仅浮动检视/助手内长文，**不出现在薄卡**） |
| 禁用 | 1.0 青 `cyan-*`、漫剧橙、助手绿 `emerald-*` |

---

## 3. 薄卡片（画布节点）

| 规则 | 说明 |
| --- | --- |
| 结构 | **标题** + 右侧 **状态徽标**（`PRO2_STAGE_BADGE_CLASS`） |
| 禁止 | `subtitle`、卡片内说明段落、内嵌长表 |
| 尺寸 | 控制类 360×140；列摘要 320×120（见 `plan-2.0.md` §2.3） |
| 选中 | `PRO2_CARD_SELECTED_CLASS` 紫罗兰 ring |
| 交互 | 点击选中 → 节点**下方**弹出浮动检视；点击画布空白关闭 |

---

## 4. 浮动检视面板

| 规则 | 说明 |
| --- | --- |
| 位置 | 默认节点**底边正中** + 10px 间距，水平居中于节点 |
| 外观 | `rounded-2xl`、深紫灰渐变底、紫罗兰描边、与薄卡同款标题栏（**仅标题，无副标题**） |
| 宽度 | `max(节点屏宽, 380px)`，上限 520px |
| 高度 | 最大约 72vh，不足时内部滚动，**不翻到节点上方** |
| 内嵌 | `CanvasNodeEmbeddedProvider`：无 `Handle` / `NodeResizer`；`ProNodeShell` 在 embedded 模式**不展示 subtitle** |

---

## 5. 剧本创作助手（pro2 画布）

与薄卡/检视同一紫罗兰主题：

- 侧栏标签、展开浮层边框、模式 Tab 选中态、用户气泡、发送钮 → `PRO2_ASSISTANT_*` 常量  
- **标题仅「剧本创作助手」**，不展示模型副标题行（pro2 模式）  
- 禁止 `STORY_CHROME_GREEN_CLASS` / `emerald-*`

---

## 6. 检视内业务 UI

- 按钮：`PRO2_INSPECTOR_ACTION_BTN_CLASS` / `PRO2_ACTION_BTN_SPLIT_CLASS`  
- 提示标签：`PRO2_HINT_LABEL_CLASS`  
- 芯片选中：`PRO2_CHIP_SELECTED_CLASS`  
- 列节点复用组件时 `edition` 必须为 **`pro2`**（`storyEditionFromNodeType` 对 `story-pro2-*` 返回 `pro2`）

---

## 7. LibTV 节点交互（文本 / 图片 / 脚本）

> 实现：`pro2-node-side-plus.tsx` · `normalize-graph-nodes.ts` `PRO2_LIBTV_DRAG_ANYWHERE_TYPES` · `flow-canvas.tsx` `connectionRadius`

### 7.1 整卡拖动

| 规则 | 说明 |
| --- | --- |
| 类型 | `story-pro2-starter` / `story-pro2-image` / `story-pro2-script-hub` / `story-pro2-frame` |
| 拖动 | **不设** `dragHandle`，标题栏与卡片空白区均可拖动画布节点 |
| 例外 | 按钮、输入、滚动区、预览层标记 `nodrag` / `nowheel`，不触发拖节点 |
| `+` 生成 | `addNode` 后须 `ensureNodeDragHandles`；生成后 **选中新节点**（`selectPro2NodeAfterSpawn`） |

### 7.2 侧栏 `+`（选中时出现）

**所有**带侧 `+` 的节点须复用 `Pro2NodeSidePlus`，禁止第二套菜单或裸 `Handle`。

| 手势 | 行为 |
| --- | --- |
| **单击** | 弹出「下一步」节点类型菜单（`PRO2_LEFT_ADD_MENU` / `PRO2_RIGHT_ADD_MENU`） |
| **按住拖动** | 从 `+` 连出边；`connectionRadius` 吸附目标节点边框 Handle |
| 位移阈值 | 移动 &lt; 6px 视为点击，≥ 6px 视为拖线（`connectOnClick={false}`） |

| 侧 | Handle id | 语义 |
| --- | --- | --- |
| 左 | `plus_left`（source） | 添加上下文；`onConnect` 翻转方向为 **邻居 → 本节点** |
| 右 | `text` / `image` 等（source） | 引用生成下游 |

选中时隐藏同侧默认透明 Handle，避免与 `+` 重叠。

### 7.3 图片节点 · 空态 / 有图

| 状态 | 底部输入坞 | 顶栏工具条 | 侧 `+` | 粘贴 |
| --- | --- | --- | --- | --- |
| **无图** | 显示 `Pro2ImageInputDock` | 无 | 无 | 鼠标 **悬停本节点** 时 Ctrl+V → 写入本节点；空白画布 → 新建 `story-pro2-image` |
| **有图且选中** | **隐藏** Dock | `Pro2ImageNodeToolbar`，位于卡片上方 **`-top-[4.5rem]`**，不遮挡画面 | 右侧 `+` | 同全局规则 |

### 7.4 输入坞（Dock）

| 规则 | 说明 |
| --- | --- |
| 尺寸 | 固定 `560 × 240`（`PRO2_DOCK_WIDTH` / `PRO2_DOCK_HEIGHT`） |
| 结构 | `header` 图标行固定 · 正文区可滚动 · `footer` 工具栏固定 |
| 禁止 | Dock 底部说明文案（如「第一步…」「角色提示词…」）；**不再添加** |
| 模型 | 须 `EnginePicker`（见 `.cursor/rules/pro2-model-picker.mdc`） |

### 7.5 媒体悬停预览

| 规则 | 说明 |
| --- | --- |
| 图标 | 悬停仅 **Eye** 圆形小按钮（`size-9`），**禁止**黑底药丸 + 「预览」文案 |
| 实现 | `MediaHoverBox` · `OVERLAY_ICON_BTN`；全站 `generated` 预览统一 |
| 禁止 | `Search` 替代列内悬停预览；生成中不显示 Eye |

### 7.6 三视图媒体组

| 规则 | 说明 |
| --- | --- |
| 结构 | 脚本 hub「生成角色三视图」→ `group`（`pro2Kind: character-board`）+ 子节点 `story-pro2-three-view` |
| 顶栏 | 选中组节点 → `Pro2MediaGroupToolbar`（白点 + 网格 + 重新生成 / 解组 / 批量下载，角色组与分镜图组 100% 一致，坐标用 internal-node 绝对坐标）；选中组内/独立单张图片 → 节点**内联** `Pro2ImageNodeToolbar`（仅当该图为唯一选中项，由节点自身 `selected` 驱动，最稳）；框选 ≥2 个散节点 → `Pro2SelectionToolbar`（保存到资产 / 创建副本 / 打组） |
| 独立节点 | 底部 `+` 菜单可单独添加 `story-pro2-three-view`（无组时无组顶栏） |

### 7.7 粘贴路由

| 模式 | 激活方式 | 行为 |
| --- | --- | --- |
| `global` | 悬停空图片节点整卡 | 任意位置 Ctrl+V 写入该节点 |
| `zone` | 悬停 `.pro2-dock-ref-zone` | 仅参考图区域内粘贴进 Dock |

---

## 8. Code Review 清单

- [ ] pro2 相关文件无 `emerald` / `green` / `cyan`（1.0 青）  
- [ ] 薄卡未传 `subtitle` / 无描述 `<p>`  
- [ ] 浮动检视 header 仅 title  
- [ ] 助手在 pro2 画布使用 `theme="pro2"`  
- [ ] 新常量进 `story-pro2-node-chrome.ts`，勿复制一套色值  
- [ ] 侧 `+` 走 `Pro2NodeSidePlus`（单击菜单 + 拖线）  
- [ ] `+` 生成节点可拖且自动选中  
- [ ] 有图图片节点顶栏抬高、Dock 隐藏  
