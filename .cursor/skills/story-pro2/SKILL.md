---
name: story-pro2
description: >-
  影视专业版 2.0 (Pro2) UI 规范：表单弹层、项目资产、紫罗兰主题、与 useDialogs 分工。
  Use when adding Pro2 modals/overlays, 保存为资产, project asset panels, or when the user
  mentions 2.0 弹层 / 弹出层 / SaveProjectAssetDialog.
---

# 影视专业版 2.0 · UI Skill

## 何时加载

- 新增/改 Pro2 **表单弹层**（保存、设置、多字段提交）
- **项目资产**侧栏卡片、保存对话框、预览网格
- 用户要求与 2.0 现有弹层 **样式一致**
- Code Review Pro2 非 `useDialogs` 的自定义 Modal

节点 / Dock / 顶栏 → 见 [libtv-unified-nodes](../libtv-unified-nodes/SKILL.md)。

## 两类弹层（禁止混用壳层）

| 类型 | 用途 | 实现 |
| --- | --- | --- |
| **系统对话框** | 确认 / 提示 / 单行输入 / 二次删除 | `useDialogs()` · z **1000** · 见 `design.md` §4.5 |
| **表单弹层** | 多字段编辑 + 预览 + 提交 API | 本规范 · z **9999** · `createPortal(..., document.body)` |

**禁止** `window.alert/confirm/prompt`。表单弹层 **不得** 复制 `DialogProvider` 内卡片样式另起一套色值。

## 表单弹层 · 唯一样板

**真源组件**：`canvas-web/components/canvas/save-project-asset-dialog.tsx`  
**Host**：`SaveProjectAssetDialogHost` · 挂画布根（`CanvasPageClient`）  
**打开**：`openSaveProjectAssetDialog(draft)` · 注册 + `canvas:open-save-project-asset` 事件

详细 class 与结构 → [reference-modals.md](reference-modals.md)

### 结构（上 → 下）

```
遮罩 fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm p-4
└─ 卡片 max-w-md rounded-2xl border-white/10 bg-[#1c1c1e] p-5 shadow-2xl
   ├─ 标题 text-base font-semibold text-white
   ├─ 副标题 text-xs text-white/50
   ├─ 表单区 label text-xs text-white/60 + input/select
   ├─ fieldset 单选（保存范围 / 可见性）
   ├─ 媒体预览区（可选）
   └─ 底栏 flex justify-end gap-2
```

### 表单控件 token

| 元素 | Class |
| --- | --- |
| 文本框 / 下拉 | `w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50` |
| 标签 | `block text-xs text-white/60` · 字段间距 `mt-3`（首字段 `mt-4`） |
| 单选组 | `fieldset text-xs text-white/60` · `legend mb-1` |

### 主 / 次按钮

| | Class |
| --- | --- |
| 取消 | `rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5` |
| 确认（主） | `rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50` |

Pro2 表单主按钮用 **violet-600**（与节点 ring 同系）；危险操作用 `useDialogs` + `danger: true` 红钮，不在表单弹层混用。

### 媒体预览区（组资产 / 多图）

| 规则 | 说明 |
| --- | --- |
| 组件 | `ProjectAssetMediaPreviewGrid`（`project-asset-grid-card.tsx`） |
| 外框 | `rounded-lg border border-white/10 bg-black/30 p-2` |
| 内框 | `mx-auto aspect-square w-full max-w-[240px] rounded-md bg-black/40` |
| 组 ≥2 项 | 2×2 拼图 + 脚注 `组内 N 项预览` · `text-[10px] text-white/40` |
| 数据 | `collectProjectAssetDraftPreviewItems`（组资产含 layout 子节点） |

**禁止** 预览区单张 `max-h-32 object-contain` 大图替代网格（组资产会漏图）。

## 项目资产侧栏卡片（与弹层预览同网格）

**组件**：`ProjectAssetGridCard` · 列表 `UnifiedProjectAssetsView`  
**布局**：上标题 `类型: 名称`（truncate + title）→ 中正方形媒体 → 下「插入画布」→ 底栏锁定/共享/删除  
**网格**：`grid-cols-3 gap-x-2 gap-y-3 items-start`

## 保存为资产 · 接入约束

- 节点顶栏 / 组顶栏：复用现有 `useSaveNodeAsAsset` / `useSaveGroupAsAsset` → `openSaveProjectAssetDialog`
- **不得**新建第二套保存 Modal 或浅色卡片
- 组保存：`collectGroupChildNodesForAssetExport` 收拢全部子节点

## Code Review 清单

- [ ] 表单弹层 `createPortal` 到 `document.body`，`z-[9999]`
- [ ] 卡片 `bg-[#1c1c1e]` · `rounded-2xl` · `border-white/10`（与样板一致）
- [ ] 输入 focus `border-violet-400/50`；主钮 `bg-violet-600`
- [ ] 组/多图预览走 `ProjectAssetMediaPreviewGrid`，非单 `<img>`
- [ ] 轻量确认仍用 `useDialogs`，未用原生弹窗
- [ ] 未在 Pro2 表单弹层使用 1.0 `cyan` / 助手 `emerald`

## 权威文档

| 文档 | 用途 |
| --- | --- |
| [reference-modals.md](reference-modals.md) | 弹层 class 与 JSX 骨架 |
| `canvas-web/docs/story-pro2-design-spec.md` §10 | 设计规范正文 |
| `canvas-web/docs/design.md` §4.5 | `useDialogs` 系统对话框 |
| `.cursor/rules/no-native-dialogs.mdc` | 禁止原生弹窗 |
