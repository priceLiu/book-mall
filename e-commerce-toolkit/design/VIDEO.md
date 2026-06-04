# 电商工具箱 · 视频播放

> 与 Canvas `CanvasVideoPlayer` 对齐：**原生 `<video controls>`**，黑底容器，全站唯一播放组件。

## 组件

| 组件 | 路径 | 用途 |
|------|------|------|
| `EcomVideoPlayer` | `components/media/ecom-video-player.tsx` | 可交互播放（`controls` + `playsInline` + `preload="metadata"`） |
| `EcomVideoThumb` | 同上 | 列表/卡片缩略（`muted`、无 `controls`） |
| `EcomVideoPreviewDialog` | `components/media/ecom-video-preview-dialog.tsx` | 点击缩略后弹层全屏预览 |

## 结构（与 Canvas 一致）

```tsx
<div className="relative aspect-video … bg-black">
  <video controls playsInline preload="metadata" className="h-full w-full object-contain" />
</div>
```

- 弹层预览可传 `autoPlay`
- 缩略图槽位：**禁止** 带 `controls` 的 `<video>`；点击后弹层必须用 `EcomVideoPlayer`

## 禁止

- 自定义 seek 条、hover 才出现的控制条
- 绕过 `EcomVideoPlayer` 的裸 `<video controls>`（资产库、工作台结果区须走组件）

## 色板

播放器区域背景：**纯黑** `#000`（`bg-black`），与全站黑白蓝主色一致。
