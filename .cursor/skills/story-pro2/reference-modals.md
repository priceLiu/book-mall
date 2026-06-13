# Pro2 2.0 · 表单弹层 reference

真源：`canvas-web/components/canvas/save-project-asset-dialog.tsx`

## 遮罩 + 卡片

```tsx
// 必须 portal 到 document.body
createPortal(
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <div
      className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c1e] p-5 shadow-2xl"
      role="dialog"
      aria-modal
    >
      {/* content */}
    </div>
  </div>,
  document.body,
);
```

| Token | 值 |
| --- | --- |
| z-index | `9999`（高于画布 `z-[200]`、资产侧栏 `z-[60]`、`useDialogs` `1000`） |
| 遮罩 | `bg-black/60 backdrop-blur-sm` |
| 卡片宽 | `max-w-md` |
| 卡片底 | `#1c1c1e` |
| 圆角 | `rounded-2xl` |
| 内边距 | `p-5` |

## 标题区

```tsx
<h2 className="text-base font-semibold text-white">保存为资产</h2>
<p className="mt-1 text-xs text-white/50">写入统一项目资产库，三版画布共用。</p>
```

## 表单字段

```tsx
<label className="mt-4 block text-xs text-white/60">
  名称
  <input
    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
  />
</label>

<label className="mt-3 block text-xs text-white/60">
  类型
  <select className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
</label>
```

```tsx
<fieldset className="mt-3 text-xs text-white/60">
  <legend className="mb-1">保存范围</legend>
  <label className="mr-4 inline-flex items-center gap-1.5">
    <input type="radio" /> 本项目
  </label>
</fieldset>
```

## 媒体预览（组资产）

```tsx
<div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2">
  <div className="mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-md bg-black/40">
    <ProjectAssetMediaPreviewGrid items={previewItems} />
  </div>
  {previewItems.length >= 2 ? (
    <p className="mt-1.5 text-center text-[10px] text-white/40">
      组内 {previewItems.length} 项预览
    </p>
  ) : null}
</div>
```

预览数据：`collectProjectAssetDraftPreviewItems(draftShape)` · 见 `project-asset-media-url.ts`

## 底栏按钮

```tsx
<div className="mt-5 flex justify-end gap-2">
  <button
    type="button"
    className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5"
  >
    取消
  </button>
  <button
    type="button"
    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
  >
    确认保存
  </button>
</div>
```

## 与 useDialogs 分工

| 场景 | API |
| --- | --- |
| 保存成功/失败 toast 式 | `alert({ variant: 'success' \| 'error' })` |
| 删除资产 | `doubleConfirm` · 第二次 `danger: true` |
| 多字段 + 预览 + POST | 本表单弹层样板 |

## 相关文件

| 文件 | 职责 |
| --- | --- |
| `save-project-asset-dialog.tsx` | 弹层 UI + Host + open API |
| `project-asset-grid-card.tsx` | `ProjectAssetGridCard` · `ProjectAssetMediaPreviewGrid` |
| `unified-project-assets-view.tsx` | 侧栏三列网格 |
| `use-save-node-as-asset.ts` | 打开弹层 |
| `project-asset-group-children.ts` | 组子节点收拢 |
