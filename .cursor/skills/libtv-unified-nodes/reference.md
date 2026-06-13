# LibTV 实现索引

## 壳层结构（媒体卡）

```
LIBTV_NODE_OUTER_CLASS
  Handle(s)
  Pro2NodeSidePlus（选中）
  Pro2ImageNodeToolbar（有图 + 唯一选中，passNodeDrag）
  LIBTV_CARD_SHELL + LIBTV_CARD_DRAG
    ├─ Header
    └─ Stage（预览 / 空态 passNodeDrag · 无内嵌 Dock）
  浮动 Dock（节点下方 · nodrag）
```

## 文件路径

| 区域 | 路径 |
| --- | --- |
| 壳层 token | `canvas-web/lib/canvas/libtv-node-chrome.ts` |
| Pro2 chrome | `canvas-web/lib/canvas/story-pro2-node-chrome.ts` |
| sbv1 chrome | `canvas-web/lib/canvas/sbv1-node-chrome.ts` |
| 拖动登记 | `canvas-web/lib/canvas/normalize-graph-nodes.ts` |
| 顶栏 | `canvas-web/components/canvas/pro2/pro2-image-node-toolbar.tsx` |
| 组顶栏 | `canvas-web/components/canvas/pro2/pro2-media-group-toolbar-panel.tsx` |
| Dock 壳 | `canvas-web/components/canvas/pro2/pro2-input-dock-shell.tsx` |
| 空态 | `canvas-web/components/canvas/pro2/pro2-media-node-empty.tsx` |
| 侧 + | `canvas-web/components/canvas/pro2/pro2-node-side-plus.tsx` |
| 模型 | `canvas-web/components/canvas/engine-picker.tsx` |
| 表单弹层 | `canvas-web/components/canvas/save-project-asset-dialog.tsx` · `.cursor/skills/story-pro2/` |
| 生成中扫光 | `canvas-web/components/canvas/libtv-media-generating-state.tsx` |

### Pro2 节点

`canvas-web/components/canvas/pro2/story-pro2-*-node.tsx`

### sbv1 节点

`canvas-web/components/canvas/sbv1/sbv1-*-node.tsx`

### spawn

- Pro2: `canvas-web/lib/canvas/pro2-spawn-nodes.ts` · `pro2-spawn-select.ts`
- sbv1: `canvas-web/lib/canvas/sbv1-spawn-nodes.ts`

### 组

- `canvas-web/components/canvas/nodes/group-node.tsx`
- sbv1 布局: `canvas-web/lib/canvas/sbv1-media-group-layout.ts`
- zIndex: `canvas-web/lib/canvas/pro2-media-group-meta.ts`

## edition 差异

| | Pro2 | sbv1 |
| --- | --- | --- |
| ring | `ring-violet-400/45` | `ring-cyan-400/50` |
| spawn | `PRO2_*_ADD_MENU` | `SBV1_*_ADD_MENU` |
| 视频节点名 | — | **视频合成** |

## 画布级（两版一致）

- 自动保存: `canvas-autosave-settings.ts`（5/15/30 分钟）
- 历史: `CanvasProjectHistory` · 每项目 15 条
- 底栏: `Sbv1Dock` · `LIBTV_CANVAS_DOCK_BAR_CLASS`
- 对话框: `components/dialogs/dialog-provider.tsx`
