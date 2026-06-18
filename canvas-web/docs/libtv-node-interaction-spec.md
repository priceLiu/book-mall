# LibTV 节点交互规范（分镜视频 1.0 · 影视专业 2.0 共用）

> **统一节点目录（样式 + 功能真源）**：[`libtv-unified-node-catalog.md`](./libtv-unified-node-catalog.md)  
> **权威样板**：`sbv1-video-engine`（用户可见名 **视频合成**）  
> **壳层 token**：`lib/canvas/libtv-node-chrome.ts`  
> **拖动登记**：`normalize-graph-nodes.ts` → `PRO2_LIBTV_DRAG_ANYWHERE_TYPES`（源自 `LIBTV_DRAG_ANYWHERE_NODE_TYPES`）  
> 分镜 1.0 细则见 [`storyboard-video-1.0-node-interaction-spec.md`](./storyboard-video-1.0-node-interaction-spec.md)  
> 影视 2.0 色彩/薄卡见 [`story-pro2-design-spec.md`](./story-pro2-design-spec.md)  
> **薄卡三态（初始 / 连线 / 生成后）**：[`libtv-node-state-spec.md`](./libtv-node-state-spec.md)

## 1. 共用组件（禁止第二套实现）

| 能力 | 组件 / 模块 | 说明 |
| --- | --- | --- |
| 侧栏 `+` | `Pro2NodeSidePlus` | 单击菜单 + 按住拖线 |
| 顶栏工具条 | `Pro2ImageNodeToolbar` | 有图 + 唯一选中；须 `passNodeDrag` |
| 浮动 Dock | `Pro2ImageInputDock` / `Sbv1ImageInputDock` / `Pro2ThreeViewInputDock` / `Sbv1VideoEngineFloatingDock` | 锚点 `data-pro2-dock-anchor` + `usePro2DockPlacement`；**禁止内嵌 Dock 占满 stage** |
| Dock 壳层 | `Pro2InputDockShell` · `Pro2DockPasteZone` · `Pro2DockRefImages` · `DockUpstreamRefPreviewCard` · `Pro2DockUpstreamChips` · `Pro2DockStyleButton` | 模型选择须 `EnginePicker`；Dock 输入见 [`libtv-dock-input-spec.md`](./libtv-dock-input-spec.md) |
| 画布底 Dock | `Sbv1Dock` · `LIBTV_CANVAS_DOCK_BAR_CLASS` | 分镜 1.0 / 2.0 底部磁吸栏共用 |
| 悬停预览 | `MediaHoverBox` | 仅 Eye 小圆钮 `nodrag` |
| 空态 / 错误 | `Pro2MediaNodeEmptyState` · `Pro2MediaNodeErrorState` | 空态 **须** `passNodeDrag`（整卡可拖） |
| 角标缩放 | `Pro2NodeResizer` | 组内节点隐藏 |
| 框选工具条 | `Pro2SelectionToolbar`（Pro2）/ `SelectionToolbar`（通用） | 打组 / 保存资产；**Pro2 壳层同组顶栏** |
| 媒体组顶栏 | `Pro2MediaGroupToolbar` · `Pro2MediaGroupToolbarPanel` | 样式 **同** `Pro2ImageNodeToolbar`（`PRO2_IMAGE_NODE_TOOLBAR_*`） |

**edition 差异**仅在于：节点 `type`、spawn 映射（`pro2-spawn-nodes` vs `sbv1-spawn-nodes`）、菜单项（`PRO2_*_ADD_MENU` vs `SBV1_*_ADD_MENU`）。**样式与交互不得分叉。**

## 2. 整卡拖动

| 规则 | 说明 |
| --- | --- |
| 登记 type | 见 `LIBTV_DRAG_ANYWHERE_NODE_TYPES` |
| React Flow | **不得** 设置 `node.dragHandle` |
| 可拖区域 | 卡片 Header + Stage（预览 / 空态）；`LIBTV_CARD_DRAG_CLASS` |
| 禁止拖动 | Dock 全部 · `MediaHoverBox` Eye · 侧 `+` 菜单 · 顶栏工具条按钮（工具条空白区可拖：`passNodeDrag`） |
| 性能 | 拖动中只写 RF 本地；松手写 zustand（`flow-canvas.tsx` `deferStoreGraphSyncRef`） |
| 持久化 | 松手：`isCanvasPositionCommitOnly` 写 store（不 normalize）；`onNodeDragStop` 从 RF 兜底 `commitFlowNodePositions`；触发 `canvas:flush-autosave` 立即保存；`pagehide` 再 flush 一次 |

### 2.1 壳层结构（所有 LibTV 媒体卡统一）

```
LIBTV_NODE_OUTER_CLASS          ← overflow-visible，供侧 + 露出
  Handle(s)
  Pro2NodeSidePlus（选中时）
  Pro2ImageNodeToolbar（有图 + 唯一选中，passNodeDrag）
  LIBTV_MEDIA_CARD_SHELL_CLASS + LIBTV_CARD_DRAG_CLASS   ← 背景 #262626
    ├─ Header（图标 + 标题 + 状态）
    └─ LIBTV_MEDIA_STAGE_CLASS                           ← 背景 #262626，禁止 bg-black/40
```

**控制类节点**（文本 / 脚本）：外置标题行 + `PRO2_CARD_SHELL_CLASS`（`libtv-control-node-bg` · `#141418`）+ 预览 stage（同色，无单独暗色 overlay）。

**2.0 素材**（`story-pro2-style-asset`）：缩略图区用 `PRO2_STYLE_ASSET_CARD_SHELL_CLASS`（`#262626`，同媒体）。

**背景真源**：`lib/canvas/libtv-node-chrome.ts` · CSS 变量 `--libtv-media-node-bg` / `--libtv-control-node-bg` · 类 `.libtv-media-node-bg` / `.libtv-control-node-bg`（`app/globals.css`）。Tailwind 配置须含 `./lib/**`（见 `tailwind.config.ts`）。

### 2.2 排列持久化（禁止刷新回弹）

| 步骤 | 实现 |
| --- | --- |
| 拖动中 | 仅 RF 本地 `rfNodes` 更新（`deferStoreGraphSyncRef`） |
| 松手 | `handleNodesChange` 坐标提交 **或** `commitFlowNodePositions` 从 `getNodes()` 同步 |
| 保存 | `graphRevision` bump → `canvas:flush-autosave` **立即** autosave（不等 1.5s debounce） |
| 刷新 | `hydrate` 读已保存 `position`；**禁止**无用户操作时跑 `reflowStoryPro2Workspace` |

### 2.3 媒体节点输入坞（Pro2 + sbv1 统一）

| 规则 | 说明 |
| --- | --- |
| 禁止内嵌 Dock | `pro2ImageNodeUsesEmbeddedDock` · `sbv1ImageNodeUsesEmbeddedDock` · `pro2ThreeViewNodeUsesEmbeddedDock` **均恒为 false** |
| 浮动 Dock | 选中**唯一**节点 → 节点下方 `Pro2InputDockShell` / 视频 `Sbv1VideoEngineFloatingDock` |
| 空态整卡可拖 | Stage 使用 `Pro2MediaNodeEmptyState` + **`passNodeDrag`** |
| 三视图 | 同图片节点；`Pro2ThreeViewInputDock` |
| **唯一隐藏条件** | 仅当 **position 拖动本 Dock 所属节点** 时 `Pro2InputDockShell` 传 `hidden={true}`（`visibility:hidden`，仍挂载 · 保留输入/展开状态） |
| **必须保持显示** | 画布 **pan / zoom / 滚轮平移** · **拖角缩放 NodeResizer** · **拖动其它节点** · **组内 relayout** — Dock **不得**卸载或清空内容 |
| **禁止绑定** | 勿用 `canvasGeometryDragging` / `canvasViewportMoving` 控制 Dock 显隐（resize 与误触会误隐藏） |
| **统一实现** | **`useLibtvFloatingDock(dockNodeId)`**（`lib/canvas/use-libtv-floating-dock.ts`）· 自定义锚点（分镜格）用 **`useLibtvFloatingDockHidden`** + **`useStableLibtvDockFlowPlacement`** |
| **dockNodeId** | 须优先 **RF 选中 id**（`selectedX?.id`），再 fallback store，避免 zustand/RF 短暂不同步导致 Dock 闪没 |
| **锚点持久** | `useLibtvDockFlowPlacement`（RF + zustand 回退）+ `useStableLibtvDockFlowPlacement`（上一帧 pin） |

**适用组件（须全部一致）**：`LibtvImageInputDock` · `Sbv1VideoEngineFloatingDock` · `Pro2StarterInputDock` · `Pro2ScriptInputDock` · `Pro2ThreeViewInputDock` · `Pro2FrameCellInputDock`（hidden 规则同；锚点用格位 placement）。

**拖动登记**：`flow-canvas.tsx` · `canvasDraggingNodeId` 仅 position 拖动写入；resize 开始时 **清空** `canvasDraggingNodeId`。

## 5. 节点顶栏工具条（`Pro2ImageNodeToolbar`）

> **唯一实现**：`components/canvas/pro2/pro2-image-node-toolbar.tsx`  
> 常量：`PRO2_IMAGE_NODE_TOOLBAR_*`（同文件导出）  
> 适用：`story-pro2-image` · `story-pro2-three-view` · `sbv1-image` 等有图媒体节点；**禁止**另写第二套顶栏。

### 5.1 出现条件

| 条件 | 说明 |
| --- | --- |
| 有图 | `ossUrl` / `blobUrl` 有效 |
| 唯一选中 | 当前节点为画布唯一选中项（`soleSelected`） |
| 非生成中 | 无 `uploading` / running 态 |

### 5.2 布局与样式

| 项 | 规范 |
| --- | --- |
| 位置 | 卡片**上方**居中；`absolute left-1/2 -translate-x-1/2` · `style={{ top: -PRO2_IMAGE_NODE_TOOLBAR_OFFSET_TOP_PX }}`（默认 **60px**） |
| 壳层 | `PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS`：`rounded-xl` · `border-white/10` · `bg-[#1c1c1e]/96` · `backdrop-blur-xl` · 阴影 |
| 文案钮 | `PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS`：`text-[11px]` · icon + label · 可选 `ChevronDown` / `NEW` 角标 |
| 图标钮 | `PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS`：`size-8` · 仅 icon（下载 / 放大预览等） |
| 分隔 | `PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS` · 分组之间插入 |
| 拖动 | **必须** `passNodeDrag`：壳层 `pointer-events-none`，仅 `button` 可点；空白区仍可拖节点 |

### 5.3 内容分区（图片节点现行）

1. **生成增强**：全景 · 多角度 · 打光  
2. **布局 / 画质**：九宫格 · 高清 · 宫格切分（带下拉 ChevronDown）  
3. **操作**：智能编辑 · 下载 · 放大预览（`Maximize2`）

其他 LibTV 节点若需顶栏，**复用同一壳层与按钮 class**，只替换业务项；不得改圆角/底色/字号。

**媒体组顶栏**（Pro2 三视图/分镜图组 · sbv1 参考图组）：须走 `Pro2MediaGroupToolbarPanel`（`edition` pro2/sbv1），壳层与 §5.2 完全一致；`passNodeDrag` 默认开启。

**框选打组顶栏**（Pro2 · `Pro2SelectionToolbar`）：≥2 非组节点选中时出现；**必须**复用 `PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS` + 白点 + `LayoutGrid` + 分隔线 + `PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS`；禁止独立 pill 样式。操作：保存到资产 · 创建副本 · 打组（下拉弹层同组内「改名改色」）。

## 6. Store 约束

以下路径 **必须** 调用 `ensureNodeDragHandles`：

- `hydrate` / `finalizeHydratedGraph`
- `addNode` / `addNodeInGroup` / `duplicateNode`
- `flow-canvas.tsx` 写入 RF 前

若节点带 `dragHandle: '.canvas-node-drag-handle'` 但 DOM 无该类，则 **整节点无法拖动**。

## 7. Code Review 清单

- [ ] 新 LibTV 节点 type 已加入 `LIBTV_DRAG_ANYWHERE_NODE_TYPES`
- [ ] 壳层使用 `LIBTV_*` token，未混用外置标题栏 `dragHandle`
- [ ] Dock / Eye / 侧 + 已 `nodrag`；顶栏 `passNodeDrag`
- [ ] 空态上传用 `role="button"` div，非整卡 `<button>`
- [ ] 未新建第二套 Dock / 工具条 / 侧 + 组件
- [ ] 有图顶栏走 `Pro2ImageNodeToolbar` + `PRO2_IMAGE_NODE_TOOLBAR_*` 常量
- [ ] 媒体背景 `#262626`（壳+Stage）；控制类 `#141418`；无 Stage `bg-black/40`
- [ ] `Pro2SelectionToolbar` 与组顶栏共用 `PRO2_IMAGE_NODE_TOOLBAR_*`
- [ ] 拖动松手后刷新位置不变（`commitFlowNodePositions` + flush autosave）
