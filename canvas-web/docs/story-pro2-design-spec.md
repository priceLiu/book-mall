# 影视专业版 2.0 · UI 设计规范

> **统一节点目录（与 sbv1 共用）**：[`libtv-unified-node-catalog.md`](./libtv-unified-node-catalog.md)  
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

> **共用规范（与分镜 1.0 一致）**：[`libtv-node-interaction-spec.md`](./libtv-node-interaction-spec.md)  
> 实现：`pro2-node-side-plus.tsx` · `libtv-node-chrome.ts` · `normalize-graph-nodes.ts` `PRO2_LIBTV_DRAG_ANYWHERE_TYPES` · `flow-canvas.tsx` `connectionRadius`

### 7.1 整卡拖动

| 规则 | 说明 |
| --- | --- |
| 类型 | `story-pro2-starter` / `story-pro2-image` / `story-pro2-script-hub` / `story-pro2-three-view` / `story-pro2-frame` / `story-pro2-style-asset`（登记见 `LIBTV_DRAG_ANYWHERE_NODE_TYPES`） |
| 壳层 | **内嵌标题** + `LIBTV_CARD_SHELL_CLASS` + `LIBTV_CARD_DRAG_CLASS`（与 `sbv1-image` / `sbv1-video-engine` 同结构） |
| 拖动 | **不设** `dragHandle`；Header 与 Stage 空白区均可拖动 |
| 例外 | 按钮、输入、Dock、Eye 预览钮标记 `nodrag` / `nowheel` |
| 排列持久化 | 松手 `commitFlowNodePositions` + 立即 `canvas:flush-autosave`；禁止 refresh 后 reflow 覆盖（见 `libtv-node-interaction-spec.md` §2.2） |
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

### 7.3 图片 / 三视图 / sbv1 图片 · 空态 / 有图

| 状态 | 底部输入坞 | 顶栏工具条 | 侧 `+` | 粘贴 |
| --- | --- | --- | --- | --- |
| **无图** | **仅浮动** Dock（禁止内嵌占满 stage） | 无 | 选中时出现 | 悬停本节点 Ctrl+V |
| **有图且唯一选中** | 隐藏 Dock | `Pro2ImageNodeToolbar` · `passNodeDrag` | 左右 `+` | 同全局规则 |

空态 Stage：`Pro2MediaNodeEmptyState` + **`passNodeDrag`**。壳层与 sbv1 图片/视频合成 **同构**（见目录 §2.1）；Pro2 ring 紫罗兰，sbv1 ring  cyan。

### 7.4 节点顶栏工具条

有图且唯一选中时，**必须**使用 `Pro2ImageNodeToolbar`（`passNodeDrag`），样式见 [`libtv-node-interaction-spec.md`](./libtv-node-interaction-spec.md) §5。禁止自写顶栏或改壳层色值/圆角。

### 7.5 输入坞（Dock）

| 规则 | 说明 |
| --- | --- |
| 尺寸 | 固定 `560 × 240`（`PRO2_DOCK_WIDTH` / `PRO2_DOCK_HEIGHT`） |
| 壳层 | `Pro2InputDockShell` · token 见 `libtv-node-chrome.ts` `LIBTV_INPUT_DOCK_*`（与分镜 1.0 共用） |
| 结构 | `header` 图标行固定 · 正文区可滚动 · `footer` 工具栏固定 |
| 禁止 | Dock 底部说明文案（如「第一步…」「角色提示词…」）；**不再添加** |
| 模型 | 须 `EnginePicker`（见 `.cursor/rules/pro2-model-picker.mdc`） |
| 画布底栏 | `Pro2CanvasToolbar` 复用 `Sbv1Dock` + `LIBTV_CANVAS_DOCK_BAR_CLASS`；功能仍为 Pro2 添加节点 / 素材库菜单 |

### 7.6 媒体悬停预览

| 规则 | 说明 |
| --- | --- |
| 图标 | 悬停仅 **Eye** 圆形小按钮（`size-9`），**禁止**黑底药丸 + 「预览」文案 |
| 实现 | `MediaHoverBox` · `OVERLAY_ICON_BTN`；全站 `generated` 预览统一 |
| 禁止 | `Search` 替代列内悬停预览；生成中不显示 Eye |

### 7.7 三视图媒体组

| 规则 | 说明 |
| --- | --- |
| 结构 | 脚本 hub「生成角色三视图」→ `group`（`pro2Kind: character-board`）+ 子节点 `story-pro2-three-view` |
| 顶栏 | 选中组 → `Pro2MediaGroupToolbarPanel`（样式同 `Pro2ImageNodeToolbar` §5） |
| 独立节点 | 底部 `+` 菜单可单独添加 `story-pro2-three-view`（无组时无组顶栏） |
| Dock | **禁止内嵌 Dock**；仅浮动 `Pro2ThreeViewInputDock`（与 character-three-view 图片格一致） |

### 7.8 粘贴路由

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
- [ ] 有图图片节点顶栏 `passNodeDrag`、Dock 隐藏  
- [ ] LibTV 壳层走 `LIBTV_*` token，与 sbv1 共用组件（见 `libtv-node-interaction-spec.md`）

---

## 9. 已定稿节点规范（Pro2 · 2.0 画布）

> **状态**：下列节点与交互 **已定型**，新增能力须扩展本表，**禁止**另起第二套壳层 / Dock / 工具条。  
> **实现索引**：`components/canvas/pro2/story-pro2-*-node.tsx` · `group-node.tsx` · `lib/canvas/libtv-node-chrome.ts`

### 9.1 总览

| 节点 | `type` | 壳层 | 拖动 | 侧 `+` | 输入 Dock | 顶栏工具条 | 主要文件 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **文本** | `story-pro2-starter` | LibTV 薄卡 + 标题栏 | 整卡（无 `dragHandle`） | 左/右 · 选中 | `Pro2StarterInputDock` · 浮动 | 无 | `story-pro2-starter-node.tsx` |
| **分镜脚本** | `story-pro2-script-hub` | LibTV 薄卡 + 预览区 | 整卡 | 左/右 · 选中 | `Pro2ScriptInputDock` · 浮动 | `Pro2ScriptHubToolbar`（卡片内） | `story-pro2-script-hub-node.tsx` |
| **图片** | `story-pro2-image` | LibTV 媒体卡 | 整卡 | 左/右 · 选中 | 空态内嵌或 `Pro2ImageInputDock` | 有图 → `Pro2ImageNodeToolbar` | `story-pro2-image-node.tsx` |
| **三视图** | `story-pro2-three-view` | **同图片** LibTV 媒体卡 | 整卡 | 左/右 · 选中 | **仅** `Pro2ThreeViewInputDock` 浮动 | 有图 → `Pro2ImageNodeToolbar` | `story-pro2-three-view-node.tsx` |
| **风格** | `story-pro2-style-asset` | LibTV 薄卡 + 缩略图 | 整卡 | 右 · 选中 | **无** | 无 | `story-pro2-style-asset-node.tsx` |
| **分组** | `group` · `pro2Kind` | Pro2 媒体组框 / 点阵底 | 整卡（`LIBTV_CARD_DRAG_CLASS`） | 左/右 · 选中组 | 无 | `Pro2MediaGroupToolbarPanel` | `group-node.tsx` |

### 9.2 文本节点 · `story-pro2-starter`

| 项 | 规范 |
| --- | --- |
| 职责 | 故事大纲 / 主题 / 上传剧本入口；连下游脚本 hub 或图片 |
| 卡片 | 标题「文本」或用户命名；正文预览 `storyThemePromptDisplayMd`；无副标题 |
| 空态 Try | 上传剧本 · 文生视频 · 图片反推 · 视频分析（`TRY_ACTIONS`） |
| Dock | 唯一选中 → 浮动 `Pro2StarterInputDock`；`EnginePicker role="LLM"` |
| 侧 `+` | 左 `PRO2_STARTER_LEFT_ADD_MENU` · 右 `PRO2_RIGHT_ADD_MENU` |
| 生成 | `+` spawn 后 `selectPro2NodeAfterSpawn` + `ensureNodeDragHandles` |

### 9.3 分镜脚本节点 · `story-pro2-script-hub`

| 项 | 规范 |
| --- | --- |
| 职责 | 分镜表 / 角色表 hub；驱动三视图板、分镜图板生成 |
| 卡片 | 标题 + 内容预览 `Pro2ScriptHubContentPreview`；Tab 视图在检视 / 工具条切换 |
| 工具条 | 卡片内 `Pro2ScriptHubToolbar`（生成三视图 / 分镜图 / 打开表编辑器等） |
| Dock | 唯一选中 → `Pro2ScriptInputDock`；LLM · 表级操作 |
| 侧 `+` | 同文本节点菜单映射 |
| 表编辑 | `Pro2ScriptTableModal` / `Pro2ScriptTableEditorHost` · 二次确认破坏性操作 |

### 9.4 图片节点 · `story-pro2-image`

| 项 | 规范 |
| --- | --- |
| 职责 | 通用生图 / 分镜图（`pro2MediaRole: frame`）/ 组内占位 |
| 壳层 | `LIBTV_NODE_OUTER` → Header + Stage；`MediaHoverBox` 有图预览 |
| 空态 | 非 character-three-view：浮动 Dock + `passNodeDrag` 空态 |
| 有图 | 隐藏 Dock；顶栏 `Pro2ImageNodeToolbar` · `passNodeDrag` |
| 组内 | `Pro2NodeResizer` 隐藏；位置随媒体组 relayout，**禁止** refresh 覆盖用户排列 |
| 模型 | `EnginePicker role="IMAGE"` · 白名单见 `PRO2_FRAME_IMAGE_MODEL_KEYS` 等 |

### 9.5 三视图节点 · `story-pro2-three-view`

| 项 | 规范 |
| --- | --- |
| 职责 | 单角色三视图单元；可独立存在或在 `character-board` 组内 |
| 壳层 | **与 §9.4 图片节点 100% 同构**（`LIBTV_*` · `Pro2ImageNodeToolbar` · `MediaHoverBox`） |
| Dock | **禁止内嵌**；仅浮动 `Pro2ThreeViewInputDock` |
| 空态 | `Pro2MediaNodeEmptyState` + **`passNodeDrag`**；组内由角色板批量生成 |
| 生成 | 角色板 controller · `batchRunStoryRowsSequential` · `EnginePicker` 三视图白名单 |
| 组 | 脚本 hub 生成 → `group` `pro2Kind: character-board` + 多格 `story-pro2-three-view` |

### 9.6 风格节点 · `story-pro2-style-asset`

| 项 | 规范 |
| --- | --- |
| 职责 | 风格库素材引用；供 Dock `@` 风格芯片连接 |
| 卡片 | 缩略图 + 标题 `素材-风格-{name}`；**无**底部 Dock / 浮动检视 |
| 侧 `+` | 右 `PRO2_STYLE_ASSET_RIGHT_MENU` → 文本 / 图片 |
| 拖动 | LibTV 整卡；无顶栏工具条 |

### 9.7 分组 · Pro2 媒体组 · `group`

| 项 | 规范 |
| --- | --- |
| 类型 | `pro2Kind`: `character-board`（三视图）· `frame-board`（分镜图）· 视频组（预留） |
| 外观 | 暗色点阵底 `PRO2_MEDIA_GROUP_*` · 用户选色仅影响边框 |
| 拖动 | 组框 `LIBTV_CARD_DRAG_CLASS` · 无 `dragHandle`；子节点 zIndex 1201 / 组 1200 |
| 顶栏 | 组标题按钮选中组；选中组 → `Pro2MediaGroupToolbar` + `Pro2MediaGroupToolbarPanel` |
| 布局 | `pro2-media-group-layout` · `layoutVersion` 迁移；relayout **保留**组 position |
| 子节点 | `story-pro2-three-view` · `story-pro2-image`；组内隐藏单格 `Pro2NodeResizer` |

### 9.8 画布级能力（已定稿）

| 能力 | 规范 |
| --- | --- |
| **我的历史** | 顶栏「我的历史」→ 侧栏；每项目 **15** 条；间隔 localStorage 可配 |
| **写入时机** | 自动保存 / 手动保存 → `PATCH /api/canvas/projects/:id` 带 `historySnapshot`（服务端写库） |
| **列表刷新** | 保存成功后派发 `canvas:history-updated`；侧栏打开时自动 reload |
| **恢复** | `doubleConfirm` 二次确认 → `hydrate` 覆盖当前画布 |
| **自动保存** | `canvas-autosave-settings.ts` · debounce 1.5s · 拖动松手 `canvas:flush-autosave` |
| **Undo/Redo** | 画布工具栏；拖动时 temporal pause |
| **模型选择** | 全站 `EnginePicker`（见 `.cursor/rules/pro2-model-picker.mdc`） |

---

## 9.10 分镜视频 1.0 节点（与 Pro2 对齐）

> 细则见 [`libtv-unified-node-catalog.md`](./libtv-unified-node-catalog.md) §3.6–3.8 · [`storyboard-video-1.0-node-interaction-spec.md`](./storyboard-video-1.0-node-interaction-spec.md)

| 节点 | 与 Pro2 共用 | sbv1 专有 |
| --- | --- | --- |
| `sbv1-image` | LibTV 媒体壳 · 侧 `+` · 顶栏 · 浮动 Dock · `passNodeDrag` | cyan ring · 连视频合成 · sbv1 spawn |
| `sbv1-video-engine` | LibTV 媒体壳 · 侧 `+` · 拖动规则 | 视频合成 Dock · Seedance 生成 |
| `group` sbv1Styled | 点阵组框 · `Pro2MediaGroupToolbarPanel` | 参考图宫格 + 右视频槽 · 重排 |

---

## 10. 表单弹层（保存为资产等）

> **Cursor Skill**：`.cursor/skills/story-pro2/SKILL.md` · 细节 [reference-modals.md](../../.cursor/skills/story-pro2/reference-modals.md)

与 `useDialogs()`（§design.md 4.5 · z 1000）分工：**多字段 + 预览 + 提交** 走本壳层，**禁止**另起浅色 Modal。

| 规则 | 说明 |
| --- | --- |
| 真源 | `SaveProjectAssetDialog` · `save-project-asset-dialog.tsx` |
| 挂载 | `createPortal(..., document.body)` · **`z-[9999]`** |
| 遮罩 | `fixed inset-0 bg-black/60 backdrop-blur-sm p-4` |
| 卡片 | `max-w-md rounded-2xl border border-white/10 bg-[#1c1c1e] p-5 shadow-2xl` |
| 标题 | `text-base font-semibold text-white` + 副标题 `text-xs text-white/50` |
| 输入 | `rounded-lg border-white/10 bg-black/30` · focus `border-violet-400/50` |
| 主按钮 | `bg-violet-600 hover:bg-violet-500`（Pro2 紫罗兰，非 cyan/emerald） |
| 次按钮 | `text-white/70 hover:bg-white/5` |
| 组预览 | 正方形 `aspect-square max-w-[240px]` + `ProjectAssetMediaPreviewGrid` |
| 打开 API | `openSaveProjectAssetDialog` · Host 在 `CanvasPageClient` 根 |

侧栏资产卡片（上标题 / 中正方形 / 下插入）→ `ProjectAssetGridCard` · `UnifiedProjectAssetsView` · 三列网格。

---

## 11. Code Review 清单（节点）

- [ ] 新 Pro2 媒体节点复用 `LIBTV_*` + `Pro2ImageNodeToolbar` / `Pro2NodeSidePlus`  
- [ ] 三视图 **无** 内嵌 Dock；Dock 仅浮动  
- [ ] 媒体组 relayout 不重置用户拖动的 group position  
- [ ] 历史保存走 PATCH `historySnapshot`，禁止前端二次 POST 巨大 canvas  
- [ ] 「我的历史」列表在 `canvas:history-updated` 后刷新
