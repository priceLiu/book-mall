# LibTV 统一节点目录（影视专业 2.0 · 分镜视频 1.0）

> **真源**：交互与组件 [`libtv-node-interaction-spec.md`](./libtv-node-interaction-spec.md)  
> **Pro2 配色 / 薄卡**：[`story-pro2-design-spec.md`](./story-pro2-design-spec.md)  
> **sbv1 细则**：[`storyboard-video-1.0-node-interaction-spec.md`](./storyboard-video-1.0-node-interaction-spec.md)  
> **壳层 token**：`lib/canvas/libtv-node-chrome.ts`（`sbv1-node-chrome.ts` · `story-pro2-node-chrome.ts` 为分流别名）

**原则**：两版画布 **同一套组件、同一套壳层、同一套拖动/Dock/工具条规则**；**仅**允许以下 edition 差异：

| 允许差异 | Pro2 | sbv1 |
| --- | --- | --- |
| 节点 `type` | `story-pro2-*` | `sbv1-*` |
| 选中 ring / 图标强调 | `ring-violet-400/45` · violet 图标 | `ring-cyan-400/50` · cyan 图标 |
| spawn / 侧 `+` 菜单 | `pro2-spawn-nodes` · `PRO2_*_ADD_MENU` | `sbv1-spawn-nodes` · `SBV1_*_ADD_MENU` |
| 模型选择白名单 | `EnginePicker` + Pro2 白名单 | 同组件 + sbv1/视频规则 |
| 用户可见名 | 分镜脚本 / 三视图… | **视频合成**（`sbv1-video-engine`） |

**禁止**：第二套 Dock、工具条、侧 `+`、媒体壳层、组顶栏、原生 `window.alert/confirm`。

---

## 1. 全局交互（全部 LibTV 节点）

| 能力 | 唯一实现 |
| --- | --- |
| 整卡拖动 | `LIBTV_DRAG_ANYWHERE_NODE_TYPES` · 无 `dragHandle` · `ensureNodeDragHandles` |
| 壳层 | `LIBTV_NODE_OUTER` → 背景分流见 §1.3 + `LIBTV_CARD_DRAG` |
| 侧 `+` | `Pro2NodeSidePlus`（单击菜单 · 按住拖线 · 6px 阈值） |
| 有图顶栏 | `Pro2ImageNodeToolbar` · `passNodeDrag` · `PRO2_IMAGE_NODE_TOOLBAR_*` |
| 空态 / 错误 | `Pro2MediaNodeEmptyState` / `Pro2MediaNodeErrorState` · **空态须 `passNodeDrag`** |
| 预览 | `MediaHoverBox` · 仅 Eye 钮 `nodrag` |

### 1.2 节点顶栏工具条（唯一壳层）

| 项 | 规范 |
| --- | --- |
| 组件 | `Pro2ImageNodeToolbar` · 常量 `PRO2_IMAGE_NODE_TOOLBAR_*`（`pro2-image-node-toolbar.tsx`） |
| 适用 | 有图媒体节点：`story-pro2-image` · `story-pro2-three-view` · `sbv1-image` |
| 组顶栏 | `Pro2MediaGroupToolbarPanel` · **复用同一套** `PRO2_IMAGE_NODE_TOOLBAR_*` 壳层 |
| 框选打组顶栏 | `Pro2SelectionToolbar` · **同左**（Pro2 画布 · ≥2 散节点） |
| 位置 | 卡片上方居中 · `top: -PRO2_IMAGE_NODE_TOOLBAR_OFFSET_TOP_PX`（60px） |
| 拖动 | **须** `passNodeDrag`（空白区可拖节点 · 按钮 `nodrag`） |
| 禁止 | 自写第二套顶栏 · 组/media 节点外置 `RF_NODE_DRAG_HANDLE` 标题栏 |

未来「保存为资产」等能力 **只扩展** 本工具条 / 组顶栏 / 框选工具条，不得新建样式分叉（见 `docs/项目产资产.md`）。

### 1.3 节点卡片背景（Pro2 · sbv1）

> **真源**：`lib/canvas/libtv-node-chrome.ts` · `app/globals.css` · Pro2 薄卡 alias `story-pro2-node-chrome.ts`  
> 背景色 **必须** 用 CSS 类（`.libtv-media-node-bg` / `.libtv-control-node-bg`），**禁止**仅写 Tailwind 任意色于 `lib/` 且未进 `tailwind content`（会不生效）。

| 类别 | 色值 | Token |
| --- | --- | --- |
| 媒体（图片 / 视频 / 三视图） | `#262626` | `LIBTV_MEDIA_CARD_SHELL_CLASS` + `LIBTV_MEDIA_STAGE_CLASS` |
| 控制（文本 / 脚本） | `#141418` | `PRO2_CARD_SHELL_CLASS` · `LIBTV_CONTROL_CARD_SHELL_CLASS` |
| 2.0 素材 | `#262626` | `PRO2_STYLE_ASSET_CARD_SHELL_CLASS` |
| 组点阵底 | `#141418` | `PRO2_MEDIA_GROUP_BG` |

| `type` | 背景 |
| --- | --- |
| `story-pro2-starter` · `story-pro2-script-hub` | `#141418` |
| `story-pro2-image` · `story-pro2-three-view` · `story-pro2-style-asset` | `#262626` |
| `sbv1-image` · `sbv1-video-engine` | `#262626`（`SBV1_*` alias） |

**禁止**：媒体 Stage 单独 `bg-black/40`（会盖住 `#262626`）。

**默认尺寸**（真源 `lib/canvas/libtv-node-chrome.ts` · **Pro2 与 sbv1 须 alias，禁止分叉硬编码**）：

| 节点 / 场景 | 尺寸 | Token |
| --- | --- | --- |
| 方形图片媒体（`story-pro2-image` · `story-pro2-style-asset` · **`sbv1-image`**） | **350 × 350** | `LIBTV_SQUARE_IMAGE_NODE_*` · `PRO2_IMAGE_NODE_*` · `SBV1_IMAGE_NODE_*` |
| Pro2 分镜视频组格 | **350 × 232** | `LIBTV_VIDEO_MEDIA_NODE_*` · `PRO2_VIDEO_CELL_*` |
| **`sbv1-video-engine` / 视频合成** | **635 × 365** | `SBV1_VIDEO_ENGINE_*`（宽 stage · 不与组格同尺寸） |
| 组内分镜图格 | **296 × 196** | `PRO2_FRAME_CELL_*` |

**禁止**：sbv1 图片单独定义与 Pro2 不同的默认尺寸；新节点勿用 `libtvMediaNodeHeightForWidth`（4:3 历史 helper）。

**媒体到达后自动适配**（空态保持上表默认 · 有图/有视频后按真实宽高比改尺寸）：

| 规则 | 说明 |
| --- | --- |
| 实现 | `useLibtvMediaNodeAutoFit` · `lib/canvas/libtv-media-node-auto-fit.ts` |
| 适用 | `story-pro2-image` · `sbv1-image` · `sbv1-video-engine` |
| 探测 | 图片 `natural*` · 视频 `loadedmetadata` |
| 新媒体 | 始终重算（覆盖用户曾手动拉伸） |
| 组内 sbv1 参考图 | 宫格 relayout 用统一格，跳过自动适配 |
| 组内视频合成 | `mediaFit` + 组布局用实测尺寸 |

详见 [`storyboard-video-1.0-node-interaction-spec.md`](./storyboard-video-1.0-node-interaction-spec.md) §5.1。

### 1.4 打组 / 组顶栏样式（统一）

| 场景 | 组件 | 壳层 |
| --- | --- | --- |
| 框选 ≥2 节点后打组 | `Pro2SelectionToolbar` | `PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS` |
| 已打组 · 选中组 | `Pro2MediaGroupToolbarPanel` | 同上 |
| 有图单节点 | `Pro2ImageNodeToolbar` | 同上 |

公共结构：**白点**（`size-2.5 rounded-full bg-white/90`）+ **LayoutGrid** + **分隔线** + `PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS` 文案钮。  
组顶栏典型项：重新生成* · 重排* · 改名改色 · 批量下载 · 保存为资产 · 解组（*按 edition/kind）。  
框选工具条：保存到资产 · 创建副本 · 打组（下拉设组名/色，弹层同「改名改色」）。

| 输入坞 | **仅浮动** `Pro2InputDockShell`（560×240）· **禁止内嵌 Dock 占满 stage** |
| 模型 | `EnginePicker`（`.cursor/rules/pro2-model-picker.mdc`） |
| 组顶栏 | `Pro2MediaGroupToolbarPanel` · `edition` pro2 / sbv1 |
| 底栏 | `Sbv1Dock` + `LIBTV_CANVAS_DOCK_BAR_CLASS` |
| 保存 | debounce + `canvas:flush-autosave` · 拖动松手立即 flush |
| 历史 | PATCH `historySnapshot` · `canvas:history-updated` |

### 1.1 可拖 / 不可拖

| 可拖 | 不可拖（`nodrag`） |
| --- | --- |
| Header · Stage 空态/预览区（`passNodeDrag`） | 全部 Dock · textarea · 顶栏按钮 · Eye · 侧 `+` Handle |

---

## 2. 节点总表

### 2.1 媒体类（LibTV 媒体卡 · 同构）

| 节点 | type | 版 | 侧 `+` | 浮动 Dock | 顶栏 | 组内 Resizer |
| --- | --- | --- | --- | --- | --- | --- |
| 图片 | `story-pro2-image` | Pro2 | 左/右 | `Pro2ImageInputDock` | 有图 | 隐藏 |
| 三视图 | `story-pro2-three-view` | Pro2 | 左/右 | `Pro2ThreeViewInputDock` | 有图 | 隐藏 |
| 图片 | `sbv1-image` | sbv1 | 左/右 | `Sbv1ImageInputDock` | 有图 | 隐藏 |
| 视频合成 | `sbv1-video-engine` | sbv1 | 左/右 | `Sbv1VideoEngineFloatingDock` | 无（有视频全屏钮） | 隐藏 |

**统一空态**：Stage 居中 `Pro2MediaNodeEmptyState` + `passNodeDrag`；选中唯一 → 节点**下方**浮动 Dock（不占卡片）。

**统一有图**：隐藏 Dock · 显示 `Pro2ImageNodeToolbar`（sbv1-image）· `MediaHoverBox` 预览。

### 2.2 控制类（LibTV 薄卡）

| 节点 | type | 版 | 侧 `+` | 浮动 Dock | 顶栏 |
| --- | --- | --- | --- | --- | --- |
| 文本 | `story-pro2-starter` | Pro2 | 左/右 | `Pro2StarterInputDock` | 无 |
| 分镜脚本 | `story-pro2-script-hub` | Pro2 | 左/右 | `Pro2ScriptInputDock` | 卡片内 `Pro2ScriptHubToolbar` |
| 风格 | `story-pro2-style-asset` | Pro2 | 右 | 无 | 无 |

薄卡：标题 + 状态；**无** stage 内嵌 Dock；整卡可拖。

### 2.3 分组

| 节点 | 标识 | 版 | 外观 | 组顶栏 |
| --- | --- | --- | --- | --- |
| 媒体组 | `group` + `pro2Kind` | Pro2 | 点阵底 `PRO2_MEDIA_GROUP_*` | `Pro2MediaGroupToolbarPanel` |
| 参考图组 | `group` + `sbv1Styled` | sbv1 | **同 Pro2 点阵底** | 同左 · `edition="sbv1"` + **重排** |

组顶栏按钮（统一壳层）：`重排`* · `改名改色` · `批量下载` · `解组`（*sbv1 重排；Pro2 有组时 `重新生成`）

### 2.4 工作区列（Pro2 流水线 · 非 LibTV 媒体卡）

下列为 **Pro2 剧本流水线** 专用，不走 §2.1 媒体壳层，但须 `edition="pro2"` 配色隔离：

`story-pro2-character` · `story-pro2-scene` · `story-pro2-frame` · `story-pro2-video` · `story-pro2-style` · 列摘要板 `story-pro2-*-board`

新功能 **不得** 在 sbv1 复制列节点；sbv1 仅 §2.1–2.3。

---

## 3. 功能矩阵（按节点）

### 3.1 `story-pro2-starter` / 文本

- **样式**：LibTV 控制卡 `#141418` · 紫 ring · `PRO2_CARD_SHELL_CLASS`  
- **功能**：大纲/主题/上传剧本 · LLM `EnginePicker` · 连 hub/图片  
- **spawn**：`pro2-spawn-nodes` · `selectPro2NodeAfterSpawn`

### 3.2 `story-pro2-script-hub` / 分镜脚本

- **样式**：LibTV 控制卡 `#141418` + 预览 stage  
- **功能**：分镜表/角色表 · 生成三视图板/分镜图板 · 表编辑 Modal  
- **Dock**：LLM · 表级操作

### 3.3 `story-pro2-image` / 图片

- **样式**：LibTV 媒体卡 `#262626` · 与 sbv1-image 同构 · Stage 用 `LIBTV_MEDIA_STAGE_CLASS`  
- **功能**：生图/上传 · `@` 上游 · 风格库 · 组内 relayout 不覆盖用户排列  
- **模型**：`EnginePicker role="IMAGE"`

### 3.4 `story-pro2-three-view` / 三视图

- **样式**：同 §3.3 · `#262626`  
- **功能**：单角色三视图 · 角色板批量 · 禁止内嵌 Dock  
- **模型**：三视图白名单

### 3.5 `story-pro2-style-asset` / 风格素材

- **样式**：`PRO2_STYLE_ASSET_CARD_SHELL_CLASS` · `#262626` + 缩略图  
- **功能**：风格库引用 · 右 `+` 连文本/图片 · 无 Dock

### 3.6 `sbv1-image` / 图片

- **样式**：LibTV 媒体卡 `#262626` · cyan ring · **须** `Pro2ImageNodeToolbar`（有图）  
- **尺寸**：**350 × 350**（与 `story-pro2-image` 同 · `LIBTV_SQUARE_IMAGE_NODE_*`）  
- **功能**：上传/粘贴 · `@` · 风格库 · 连视频合成 `in_ref`  
- **spawn**：`sbv1-spawn-nodes` · 组内右槽 `spawnSbv1VideoEngineFromGroup`

### 3.7 `sbv1-video-engine` / 视频合成

- **样式**：LibTV 媒体卡 `#262626` · cyan ring · `SBV1_MEDIA_STAGE_CLASS`  
- **尺寸**：**635 × 365**（`SBV1_VIDEO_ENGINE_*` · 宽 stage · 与 Pro2 分镜视频组格 **不同**）  
- **功能**：prompt + 参考图 · 火山 Seedance · 生成/预览 · 串联下一视频合成  
- **Dock**：`Sbv1VideoEngineFloatingDock`（节点外 · 全部 nodrag）

### 3.8 `group` / 媒体组

- **样式**：点阵底 `#141418` · 组标题钮 · `LIBTV_CARD_DRAG` · Pro2 Resizer 样式  
- **功能**：打组/解组 · 改名改色 · 批量下载 · relayout · zIndex 选中置顶  
- **顶栏**：`Pro2MediaGroupToolbarPanel`；框选打组前 → `Pro2SelectionToolbar`（**同壳层**）  
- **sbv1 布局**：左参考图宫格 + 右单视频槽 · 组外串联视频

---

## 4. 画布级（两版一致）

| 能力 | 配置 |
| --- | --- |
| 自动保存 | 5 / 15 / 30 分钟 + 1.5s debounce · `canvas-autosave-settings.ts` |
| 我的历史 | 每项目 15 条 · PATCH 写库 · `canvas:history-updated` |
| 沉浸顶栏 | Pro2/sbv1 全屏 · 鼠标顶缘唤出 |
| 框选工具条 | `Pro2SelectionToolbar`（Pro2 · 与组顶栏同壳层）/ `SelectionToolbar`（通用） |

---

## 5. Code Review（新节点准入）

- [ ] 已登记 `LIBTV_DRAG_ANYWHERE_NODE_TYPES`（若整卡可拖）
- [ ] 壳层 `LIBTV_*` · 背景 `#262626`（媒体）/ `#141418`（控制）· 未用外置 `dragHandle` / 旧 `PRO2_MEDIA_CARD_SHELL`
- [ ] 框选工具条 / 组顶栏共用 `PRO2_IMAGE_NODE_TOOLBAR_*`
- [ ] 侧 `+` → `Pro2NodeSidePlus` · spawn 后 `select*AfterSpawn` + `sortNodesForReactFlow`
- [ ] 媒体节点：**无**内嵌 Dock · 空态 `passNodeDrag` · 有图顶栏 `passNodeDrag`
- [ ] 组 → `Pro2MediaGroupToolbarPanel` · 点阵底 · 单视频槽（sbv1）
- [ ] 模型 → `EnginePicker` · 无裸 `<select>` 模型列表
- [ ] 对话框 → `useDialogs()` · 删除 → `doubleConfirm`
- [ ] 默认尺寸：图片 `LIBTV_SQUARE_IMAGE_NODE_*`（sbv1 与 Pro2 同值）· 视频合成 `SBV1_VIDEO_ENGINE_*`（635×365）

---

## 6. 实现索引

| 区域 | 路径 |
| --- | --- |
| Pro2 节点 | `components/canvas/pro2/story-pro2-*-node.tsx` |
| sbv1 节点 | `components/canvas/sbv1/sbv1-*-node.tsx` |
| 组 | `components/canvas/nodes/group-node.tsx` |
| 组顶栏 | `pro2-media-group-toolbar-panel.tsx` · `sbv1-media-group-toolbar.tsx` |
| spawn Pro2 | `lib/canvas/pro2-spawn-nodes.ts` · `pro2-spawn-select.ts` |
| spawn sbv1 | `lib/canvas/sbv1-spawn-nodes.ts` |
| 组布局 sbv1 | `lib/canvas/sbv1-media-group-layout.ts` |
| 拖动 normalize | `lib/canvas/normalize-graph-nodes.ts` |
