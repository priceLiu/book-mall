# 电商工具箱 · 视频展示与预览

> 与图片规范 **`MEDIA.md`** 对称：列表缩略、悬停操作、弹层预览、下载须全站统一。  
> 播放内核与 Canvas 对齐：**原生 `<video controls>`**，黑底容器。

---

## 0. 统一组件映射（强制）

| 场景 | 唯一组件 | 路径 |
|------|----------|------|
| **资产库 / 结果网格缩略** | `EcomMediaLibraryTile` · `kind="video"` | `components/media/ecom-media-library-tile.tsx` |
| **点击后全屏预览** | `EcomVideoPreviewDialog` | `components/media/ecom-video-preview-dialog.tsx` |
| **弹层内播放器** | `EcomVideoPlayer` | `components/media/ecom-video-player.tsx` |
| 无封面时列表取帧 | `EcomVideoThumb` | 同上 |
| 有封面时悬停预览 | `EcomVideoHoverPreview` | 同上 |
| 下载 | `downloadMediaUrl()` | `lib/ecom-media-download.ts` |

**禁止** 列表 / 工作台结果区使用裸 `<video controls>` 或自写 lightbox。

---

## 1. 列表缩略（与图片同一套 Tile）

视频须走 **`EcomMediaLibraryTile`**，悬停 **纯图标**（Eye / Download），规范与 `MEDIA.md` §悬停操作 **完全一致**：

```tsx
<EcomMediaLibraryTile
  kind="video"
  src={videoOssUrl}
  thumbnailSrc={coverUrl}
  onPreview={() => setPreview({ src, title, poster: coverUrl })}
  onDownload={() => void downloadMediaUrl(url, filename)}
  onDelete={…}  // 可选 · doubleConfirm
/>
```

### 封面 + 悬停自动播放

| 条件 | 行为 |
|------|------|
| `thumbnailSrc` 为真实封面（≠ `src`） | 静态 `<Image>`；**悬停**才挂载 `EcomVideoHoverPreview`（静音 loop） |
| 无封面 | `EcomVideoThumb` 取首帧 |

**禁止** 列表内多路 `<video>` 同时预载 mp4。

### 选择模式

当前资产 Picker **仅图片**；若未来视频可选，须复用同一 Tile + 选择态规则（见 `MEDIA.md` §选择模式）。

---

## 2. 弹层预览（强制 · 与 Canvas lightbox 一致）

**唯一入口**：缩略悬停 **Eye** 或业务「预览成片」→ **`EcomVideoPreviewDialog`**。

```tsx
<EcomVideoPreviewDialog
  src={videoUrl}
  poster={coverUrl}
  open={open}
  onOpenChange={setOpen}
  title="镜头 3 · 成片"
/>
```

### 内部固定配置

```tsx
<EcomVideoPlayer
  src={src}
  poster={poster}
  autoPlay
  adaptiveBackdrop
  frameless
/>
```

| 属性 | 含义 |
|------|------|
| **frameless** | 无圆角外框；原生 controls 贴边 |
| **adaptiveBackdrop** | 按 intrinsic 比例缩放；模糊 poster / 渐变背景 |
| **autoPlay** | 打开即播（用户手势由弹层打开满足） |

### 弹层 chrome

- `ModalPortal` · 全屏 `bg-black/88 backdrop-blur-md` · `z-[2000]`
- 顶栏：标题 + **下载 mp4** + 关闭
- 点击遮罩关闭；Esc 关闭
- **不含**图片那套滚轮缩放（视频仅原生 controls）

---

## 3. 工作台内嵌播放（结果卡片 / 交付查阅）

| 场景 | 做法 |
|------|------|
| 小窗 / 槽位内预览 | `EcomVideoPlayer` 或 `EcomVideoSlot`（无 controls 时用 Thumb + 点击开 Dialog） |
| 交付包查阅多镜 | 列表 Tile + Eye → **`EcomVideoPreviewDialog`**（与资产库相同） |

**禁止** 结果区单独写 `<video controls className="…">` 而不经组件。

---

## 4. 与图片规范对照

| 能力 | 图片 | 视频 |
|------|------|------|
| 网格缩略 | `EcomMediaLibraryTile` · `kind="image"` | 同 · `kind="video"` |
| 悬停 Eye | → `EcomImagePreviewDialog` | → `EcomVideoPreviewDialog` |
| 悬停 Download | `downloadMediaUrl` | 同 |
| 弹层背景 | 黑底 + 缩放平移 | 黑底 + 原生 controls |
| 上传区 | `EcomRefUploadCard`（图片） | 种草/微剧成片走生成 API。**拆图拆视频** 用同一卡片 `allowVideo`，预览走 `EcomVideoPreviewDialog` |

---

## 5. 禁止

- 自定义 seek 条、hover 才出现的控制条
- 绕过 `EcomVideoPlayer` 的裸 `<video controls>`
- 列表缩略用文字「播放」链代替 Eye 图标
- 预览弹层用白底 Radix Dialog（须 `EcomVideoPreviewDialog` 黑底 lightbox）
- 视频预览弹层与图片预览混用同一 Dialog 组件

## 6. Code Review

- 资产库 / 结果区视频未走 `EcomMediaLibraryTile` → 驳回
- 预览未走 `EcomVideoPreviewDialog` → 驳回
- 播放器未设 `frameless` + `adaptiveBackdrop` → 驳回

## 色板

播放器区域背景：**纯黑** `#000`（`bg-black`），与全站黑白蓝主色一致。
