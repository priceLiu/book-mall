# 分镜视频 1.0 · 节点交互规范（v1.0）

> **共用规范（与影视 2.0 一致）**：[`libtv-node-interaction-spec.md`](./libtv-node-interaction-spec.md)  
> **权威样板**：`sbv1-video-engine`（用户可见名 **视频合成**）  
> 实现：`components/canvas/sbv1/sbv1-video-engine-node.tsx`  
> 图片节点 **必须** 与本规范对齐，禁止单独发明拖动/壳层逻辑。

## 1. 整卡拖动（核心）

| 规则 | 说明 |
| --- | --- |
| 节点 type | `sbv1-image`、`sbv1-video-engine` |
| React Flow | **不得** 设置 `node.dragHandle`（登记于 `normalize-graph-nodes.ts` → `PRO2_LIBTV_DRAG_ANYWHERE_TYPES`） |
| 可拖区域 | 标题栏 + 预览区 + 空态区；整卡 `SBV1_CARD_DRAG_CLASS`（`cursor-grab` / `active:cursor-grabbing`） |
| 流畅性 | 拖动过程只更新 RF 本地 state；松手再写 zustand（`flow-canvas.tsx` `deferStoreGraphSyncRef`） |

### 1.1 禁止拖动（须加 `nodrag`）

| 区域 | 节点 |
| --- | --- |
| 内嵌 / 浮动输入坞（Dock） | `Sbv1ImageNodeEmbeddedDock` · `Sbv1ImageInputDock` 全部 |
| 小眼睛预览 | 图片 `MediaHoverBox` · `OVERLAY_ICON_BTN` |
| 全屏预览层 | 弹层本身 |

**图片节点**：顶栏 `Pro2ImageNodeToolbar` 须 `passNodeDrag`（空白区可拖，仅按钮 `nodrag`）。**不得**在标题、预览区、空态提示区加 `nodrag`。

### 1.2 壳层结构（`sbv1-image` 与 `sbv1-video-engine` 统一）

```
SBV1_NODE_OUTER_CLASS          ← overflow-visible，供侧 + 露出
  Handle(s)
  Pro2NodeSidePlus（选中时）
  SBV1_CARD_SHELL_CLASS + SBV1_CARD_DRAG_CLASS
    ├─ Header（图标 + 标题 + 状态）
    └─ Stage（预览 / 空态 / 内嵌 Dock[nodrag]）
```

- Token：`lib/canvas/libtv-node-chrome.ts`（`sbv1-node-chrome.ts` 为别名导出）
- 图片：`sbv1-image-node.tsx`（**禁止** Pro2 外置标题栏 + `PRO2_MEDIA_CARD_SHELL`）
- 视频合成：`sbv1-video-engine-node.tsx`
- React Flow 同步：`flow-canvas.tsx` 写入 RF 前须 `ensureNodeDragHandles`

### 1.3 空态点击上传

- 使用 `<div role="button">` + `onClick`，**禁止** `<button>`（避免部分浏览器阻断节点拖动）
- 粘贴：悬停/选中节点时 `usePointerImagePasteHost`

## 2. 侧栏 `+`（选中时出现）

复用 `Pro2NodeSidePlus`；规则同 Pro2 §7.2（单击菜单 / 按住拖线，`connectionRadius: 30`）。

| 节点 | 左 + | 右 + |
| --- | --- | --- |
| `sbv1-image` | 文生图 / 图生图 | 视频合成（自动 `image → in_ref`） |
| `sbv1-video-engine` | 图片（自动连线） | 串联下一视频合成 |

## 3. 视频合成 · 浮动 Dock

选中唯一 `sbv1-video-engine` 时，节点下方渲染 `Sbv1VideoEngineFloatingDock`：

- 锚点：`data-sbv1-dock-anchor={nodeId}` + `useSbv1DockPlacement`
- 壳层：`Sbv1VideoEngineChatInput` · 全部 `nodrag`
- 与节点卡片 **分离**；拖动节点时不拖 Dock

## 4. 图片 · 预览

- 有图：`MediaHoverBox` · 悬停仅 **Eye** 小圆钮打开全屏预览
- 禁止整图点击预览；禁止 sbv1 挂载 Pro2 顶栏工具条

## 5. 尺寸与缩放

| 节点 | 默认宽 | 最小高 | 组内 Resizer |
| --- | --- | --- | --- |
| `sbv1-image` | `SBV1_IMAGE_NODE_WIDTH` | `PRO2_IMAGE_NODE_MIN_HEIGHT` + header | 组外可选中缩放 |
| `sbv1-video-engine` | `SBV1_VIDEO_ENGINE_WIDTH` | `SBV1_VIDEO_ENGINE_MIN_HEIGHT` | 组外可选中缩放 |

## 6. Store 约束

以下路径 **必须** 调用 `ensureNodeDragHandles`，保证 sbv1 节点无残留 `dragHandle`：

- `hydrate` / `finalizeHydratedGraph`
- `addNode`
- `addNodeInGroup`
- `duplicateNode`

若节点带 `dragHandle: '.canvas-node-drag-handle'` 但 DOM 无该类，则 **整节点无法拖动**（历史 bug 根因）。

## 8. 图片节点 · Pro2 功能对齐

| 能力 | 实现 |
| --- | --- |
| 顶栏工具条 | `Pro2ImageNodeToolbar` · 有图 + 唯一选中 |
| 空态 Dock | `Sbv1ImageNodeEmbeddedDock` · 占满卡片 |
| 有图 Dock | `Sbv1ImageInputDock` · 节点下方浮动 |
| 左右 `+` | `PRO2_IMAGE_LEFT_ADD_MENU` / `PRO2_RIGHT_ADD_MENU` · spawn 映射 sbv1 |
| 风格库 | `Pro2DockStyleButton` → `StyleLibraryModal` |
| 上游 chip | `Pro2DockUpstreamChips` · `in_image` 入边 |
| 整卡拖动 | 同 §1；**仅** Dock 与小眼睛例外；顶栏工具条 `passNodeDrag` |

**视频合成**节点仍按 §1–§3（当前实现为权威，不套用 Pro2 图片 Dock）。

## 9. Code Review 清单

- [ ] sbv1 新节点 type 已加入 `PRO2_LIBTV_DRAG_ANYWHERE_TYPES` 或明确使用标题栏 `dragHandle`
- [ ] 壳层使用 `SBV1_*` token，未混用 Pro2 标题外置 + `RF_NODE_DRAG_HANDLE`
- [ ] 交互区（Dock / Eye / 侧 +）已 `nodrag`
- [ ] 空态未用 `<button>` 包裹整卡
- [ ] 图片节点已挂载 `Pro2ImageNodeToolbar`（有图时）与 `Sbv1ImageInputDock`
