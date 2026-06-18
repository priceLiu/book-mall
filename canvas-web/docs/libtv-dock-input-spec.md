# LibTV Dock 输入区规范（@mention · 内联缩略图 · 参考图条）

> **适用**：`Sbv1VideoEngineFloatingDock` · `LibtvImageInputDock` / `Sbv1ImageInputDock` · Pro2 各类 `*InputDock`  
> **关联**：[`libtv-node-interaction-spec.md`](./libtv-node-interaction-spec.md) §2.3 · [`libtv-generate-settings-spec.md`](./libtv-generate-settings-spec.md) · `MentionsTextarea`

## 1. 结构（视频 Dock 样板）

```
Pro2InputDockShell
├─ 正文 scroll：MentionsTextarea（mentionInlineThumb + mentionEdition）
└─ footer
   ├─ Pro2DockContextBar：上游参考图条（连线 thumbnail + X）
   └─ Pro2DockToolbar：上传 / 设置 / 发送
```

**禁止** footer 上方单独 pill 行展示 @ 缩略图；内联图必须在 **textarea 正文流** 内。

## 2. 内联 @ 缩略图（占位符方案 · 固定实现）

| 项 | 规范 |
| --- | --- |
| 开关 | `MentionsTextarea` · `mentionInlineThumb` |
| 版别 | `mentionEdition="sbv1"`（cyan 20px）/ 默认 pro2（紫 16px） |
| 位置 | 每个 `@label` **文字紧后**，同一行内联 |
| 实现 | `mention-inline-thumb-placeholder.ts` + `mention-inline-thumbs.tsx` |
| 占位 | em space `\u2003` · sbv1 **2 字** · pro2 **1 字** |
| textarea | 透明字 + 占位符参与换行（`MENTION_INLINE_THUMB_TEXTAREA_CLASS`） |
| mirror | 占位符渲染为 `<img inline-block>`，**禁止** overlay 绝对定位测量 |
| 存盘 | `stripMentionThumbSlots` 后再 `promptFromDisplay` · 不占 canonical |

### 2.1 数据流

1. `promptToDisplay` → `@label`
2. `ensureMentionThumbSlots` → `@label` + `\u2003…`
3. 用户编辑 → 每次 input 后 re-ensure（占位始终贴在 mention 末尾）
4. `stripMentionThumbSlots` → `promptFromDisplay` → `@<id>`

### 2.2 Code Review

- [ ] 是否仍用 `getMentionRangeClientRect` + overlay 绝对定位贴图？→ **驳回**
- [ ] mirror 是否硬编码 `break-words` 导致与 textarea 换行不一致？
- [ ] 新 Dock 是否 `mentionInlineThumb` + 正确 `mentionEdition`？

## 3. 悬停大图预览

| 项 | 规范 |
| --- | --- |
| 组件 | `MentionHoverPreviewPortal` |
| 默认位 | **`placement="above-pointer"`** · 360×360 · 卡片底边在指针/锚点顶上方 **40px** |
| 指针 | 须传 `pointerX` / `pointerY`（`onMouseMove` 跟踪） |
| 禁止 | `auto` 模式下翻转到锚点 **下方**（footer 参考条会被挡住） |

### 3.1 适用入口

- `MentionsTextarea` · `mentionHoverPreview`（内联 @ 缩略图 / @ 文案）
- `DockUpstreamRefPreviewCard` · 视频引擎上游连线参考图
- `Pro2DockRefImages` · 图片 Dock 参考 chip

## 4. Footer 参考图条

### 4.1 视频引擎（上游连线）

| 项 | 规范 |
| --- | --- |
| 组件 | **`DockUpstreamRefPreviewCard`** |
| 样式 | `SBV1_REF_THUMB_CLASS` + active/idle border |
| 角标 | 左上「已入库 / 入库中 / 未入库」 |
| 右上 | **常显 X** · 断开连线（`nodrag` · `z-10`） |
| 悬停 | `MentionHoverPreviewPortal` · `above-pointer` |

### 4.2 图片 Dock（本地 ref / spawn）

| 项 | 规范 |
| --- | --- |
| 组件 | **`Pro2DockRefImages`** · `DockRefImageChip` |
| 右上 | **常显 X** · 删除 ref + 同步 strip prompt |
| 悬停 | 同上 |

## 5. MentionsTextarea 推荐 props（视频 / 图片 Dock）

```tsx
<MentionsTextarea
  mentionInlineThumb
  mentionEdition="sbv1" // 或 "pro2"
  mentionHoverPreview
  // mentionInlineThumbHoverOnText  // 默认关；需 @ 文案悬停时再开
  …
/>
```

## 6. 文件索引

| 文件 | 职责 |
| --- | --- |
| `lib/canvas/mention-inline-thumb-placeholder.ts` | 占位符 insert/strip |
| `components/canvas/mentions/mention-inline-thumbs.tsx` | mirror 内联渲染 |
| `components/canvas/mentions/mention-hover-preview.tsx` | 悬停大图 |
| `components/canvas/pro2/dock-upstream-ref-preview-card.tsx` | 视频上游参考 card |
| `components/canvas/pro2/pro2-dock-ref-images.tsx` | 图片 Dock ref chip 行 |
