---
name: libtv-unified-nodes
description: >-
  Implements and reviews LibTV canvas nodes for 影视专业 2.0 (Pro2) and 分镜视频 1.0 (sbv1).
  Covers node shell, drag, floating dock, Pro2ImageNodeToolbar, group toolbar, spawn, and
  EnginePicker. Use when editing canvas-web pro2/**, sbv1/**, group-node, LibTV docs, or when
  the user asks to unify node UI/UX across Pro2 and sbv1.
---

# LibTV 统一节点（Pro2 · sbv1）

## 何时加载

- 新建/改 `canvas-web` 节点、Dock、组顶栏、spawn
- 用户要求 Pro2 / sbv1 / LibTV **样式或交互对齐**
- Code Review 画布节点 PR

## 核心原则

**同一套组件**；仅允许：`type`、spawn 菜单、ring 色（紫 / cyan）、模型白名单、用户可见名。

### 默认尺寸（强制 · alias `libtv-node-chrome.ts` / `sbv1-node-chrome.ts`）

| 节点 | 350×350 方形 | 视频 |
| --- | --- | --- |
| Pro2 | `story-pro2-image` · `story-pro2-style-asset` | 分镜视频组格 **350×232** |
| sbv1 | **`sbv1-image`** | **`sbv1-video-engine` 635×365** |

**禁止** sbv1 图片单独定义与 Pro2 不同的默认尺寸；视频合成使用 `SBV1_VIDEO_ENGINE_*`，不与 Pro2 组格 alias。

**媒体到达后**：空态用上表默认尺寸；上传/生成完成后 `useLibtvMediaNodeAutoFit` 按真实宽高比改节点外框（见 `libtv-media-node-auto-fit.ts` · 文档 §5.1）。

| 禁止 | 唯一实现 |
| --- | --- |
| 第二套 Dock / 顶栏 / 侧 `+` / 媒体壳 / 组顶栏 | 见下表 |
| 内嵌 Dock 占满 stage | `*UsesEmbeddedDock()` **恒 false** |
| 媒体空态不可拖 | `Pro2MediaNodeEmptyState` + **`passNodeDrag`** |
| 裸 `<select>` 模型列表 | `EnginePicker` |
| 生图/生视频 loading 仅 Loader2 | `LibtvMediaGeneratingState` |
| 手写媒体尺寸计算 | `useLibtvMediaNodeAutoFit` · `libtv-media-node-auto-fit.ts` |
| `window.alert/confirm/prompt` | `useDialogs()` |

| 能力 | 组件 / 模块 |
| --- | --- |
| 壳层 token | `lib/canvas/libtv-node-chrome.ts` |
| 整卡拖动 | `LIBTV_DRAG_ANYWHERE_NODE_TYPES` · 无 `dragHandle` |
| 侧 `+` | `Pro2NodeSidePlus` |
| 浮动 Dock | `Pro2InputDockShell`（560×240） |
| 有图顶栏 | `Pro2ImageNodeToolbar` + `passNodeDrag` · `PRO2_IMAGE_NODE_TOOLBAR_*` |
| 组顶栏 | `Pro2MediaGroupToolbarPanel` · `edition` pro2/sbv1 |
| 空态/错误 | `Pro2MediaNodeEmptyState` / `Pro2MediaNodeErrorState` |
| **生图/生视频生成中** | **`LibtvMediaGeneratingState`** · 见 [story-pro2 §扫光](../story-pro2/reference-generating.md) |
| 预览 | `MediaHoverBox` · 仅 Eye `nodrag` |
| **Dock @ 悬停预览** | **`MentionHoverPreviewPortal`** · `above-pointer` · 见 [`libtv-dock-input-spec.md`](./libtv-dock-input-spec.md) |
| spawn 后 | `select*AfterSpawn` + `sortNodesForReactFlow` |
| **浮动 Dock 持久化** | **`useLibtvFloatingDock(dockNodeId)`** · 仅拖动所属节点时 `hidden` · 见 `libtv-node-interaction-spec.md` §2.3 |

## 节点速查

### 媒体卡（同构）

| type | 版 | Dock | 顶栏 |
| --- | --- | --- | --- |
| `story-pro2-image` | Pro2 | `Pro2ImageInputDock` | 有图 |
| `story-pro2-image` · `pro2MediaRole=prop/mood` | Pro2 | 同左 | 有图 |
| `story-pro2-three-view` | Pro2 | `Pro2ThreeViewInputDock` | 有图 |
| `sbv1-image` | sbv1 | `Sbv1ImageInputDock` | 有图 |
| `sbv1-video-engine` | sbv1 / **Pro2 公告栏分镜视频** | `Sbv1VideoEngineFloatingDock` | 无（视频预览钮） |

### 薄卡（Pro2）

`story-pro2-starter` · `story-pro2-script-hub` · `story-pro2-style-asset` — 无 stage 内嵌 Dock。

### 分组

`group` + `pro2Kind` 或 `sbv1Styled` — 点阵底 · `Pro2MediaGroupToolbarPanel`。

### 不复制到 sbv1

Pro2 流水线列节点（`story-pro2-character` / `frame` / `video` 等）— 见目录 §2.4。

## 新节点工作流

```
1. 读 reference.md 与 libtv-unified-node-catalog.md
2. 选壳层：媒体卡 LIBTV_* / 薄卡 thin-card-shell
3. 登记 LIBTV_DRAG_ANYWHERE_NODE_TYPES（若整卡可拖）
4. 侧 + → Pro2NodeSidePlus + 对应 spawn 文件
5. 媒体：空态 passNodeDrag · 仅浮动 Dock · 有图 Pro2ImageNodeToolbar · **生成中 LibtvMediaGeneratingState**
6. 组：Pro2MediaGroupToolbarPanel + 点阵底
7. 模型：EnginePicker + 白名单常量
8. 自检 §5 Code Review 清单
```

## 顶栏扩展（含「保存为资产」）

- **不得**新建顶栏壳层
- 新按钮挂 `Pro2ImageNodeToolbar` / `Pro2MediaGroupToolbarPanel`
- 使用 `PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS` 或 `ICON_BTN_CLASS`
- 保存弹层样式 → [story-pro2](../story-pro2/SKILL.md) · 规范：`canvas-web/docs/libtv-unified-node-catalog.md` §1.2

## 权威文档（改前先读）

| 文档 | 用途 |
| --- | --- |
| [reference.md](reference.md) | 路径索引 + 壳层结构 |
| `canvas-web/docs/libtv-unified-node-catalog.md` | 节点目录真源 |
| `canvas-web/docs/libtv-node-interaction-spec.md` | 交互细则 |
| `canvas-web/docs/story-pro2-design-spec.md` | Pro2 配色/薄卡 |
| `canvas-web/docs/storyboard-video-1.0-node-interaction-spec.md` | sbv1 细则 |
| [reference-dock-mentions.md](reference-dock-mentions.md) | Dock @ 悬停预览 |
| `.cursor/rules/libtv-unified-nodes.mdc` | PR 门禁 |

## Code Review 清单

- [ ] `LIBTV_*` 壳层；未用 `PRO2_MEDIA_CARD_SHELL` / 外置 `RF_NODE_DRAG_HANDLE`（LibTV 媒体卡）
- [ ] 无内嵌 Dock；空态 `passNodeDrag`
- [ ] spawn 后排序 + 选中
- [ ] 组顶栏/媒体顶栏复用 `PRO2_IMAGE_NODE_TOOLBAR_*`
- [ ] `EnginePicker`；`useDialogs`；删除 `doubleConfirm`
- [ ] **生图 + 生视频** stage：`LibtvMediaGeneratingState`（Pro2 violet · sbv1 cyan）
- [ ] Dock 文案 `@mention` 悬停预览走 `MentionsTextarea`（mentionable 含 `previewUrl`）
