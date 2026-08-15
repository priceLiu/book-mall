# 电商工具箱 · 视频播放

> 与 Canvas `CanvasVideoPlayer` 对齐：**原生 `<video controls>`**，黑底容器，全站唯一播放组件。

## 组件

| 组件 | 路径 | 用途 |
|------|------|------|
| `EcomVideoPlayer` | `components/media/ecom-video-player.tsx` | 可交互播放（`controls` + `playsInline` + `preload="metadata"`） |
| `EcomVideoThumb` | 同上 | 列表/卡片缩略取帧（`muted`、无 `controls`）；仅在**无封面图**时使用 |
| `EcomVideoHoverPreview` | 同上 | 列表卡片**悬停自动播放**（`muted` + `loop`、无 `controls`），悬停时才挂载 |
| `EcomVideoPreviewDialog` | `components/media/ecom-video-preview-dialog.tsx` | 点击缩略后弹层全屏预览 |

## 结构（与 Canvas 一致）

```tsx
<div className="relative aspect-video … bg-black">
  <video controls playsInline preload="metadata" className="h-full w-full object-contain" />
</div>
```

- 弹层预览可传 `autoPlay`
- 缩略图槽位：**禁止** 带 `controls` 的 `<video>`；点击后弹层必须用 `EcomVideoPlayer`

## 资产库 / 列表缩略

视频缩略须走 `EcomMediaLibraryTile`（`kind="video"`），悬停显示 **Eye / Download** 纯图标，禁止文字按钮。详见 `MEDIA.md` §悬停操作。

有封面图时静态只渲染封面，**悬停才播放**（`EcomVideoHoverPreview`）；见 `MEDIA.md` §视频缩略：封面 + 悬停自动播放。

## 禁止

- 自定义 seek 条、hover 才出现的控制条
- 绕过 `EcomVideoPlayer` 的裸 `<video controls>`（资产库、工作台结果区须走组件）

## 色板

播放器区域背景：**纯黑** `#000`（`bg-black`），与全站黑白蓝主色一致。
