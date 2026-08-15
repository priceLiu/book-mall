# 电商工具箱 · 图片、上传与预览

> 母规范：`SYSTEM.md` §8。视频见 `VIDEO.md`。

## 资产库列表布局

### 分类层级（面包屑）

资产须按 **大类 → 模块 → 项目名** 展示，示例：

```text
电商 / 电商主图 / 灰紫冲锋衣_20250814-120000
```

| 层级 | 来源 |
|------|------|
| 大类 | `image` → 电商；`video` → 视频；`brand` → 品牌 |
| 模块 | `main-image` → 电商主图；`detail-page` → 电商详情页；等 |
| 项目名 | 出图时写入 `EcomAsset.meta.projectName`，或关联 `projectId` 查 Brief / 工作流快照标题；无则「未命名项目」 |

同一项目名下的图片/视频 **归为一组**，组内用统一网格排布。

### 网格密度（强制）

资产库、各模块「本模块资产」结果区：

```tsx
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";

<ul className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
  {/* 一行 5 张（md+）；小屏 3～4 列 */}
</ul>
```

- **禁止** 大卡片（原 `aspect-square` 占 1/3 屏宽、`rounded-[18px]` + 底部文字栏）
- 缩略图：`aspect-square` + `rounded-lg` + `border-[#e8e8ed]`
- 间距：`gap-2`

## 悬停操作（图片 / 视频 · 强制）

**所有** 资产库与模块结果区的图片、视频缩略图，悬停须显示 **纯图标** 操作层，**禁止** 「预览」「下载」等文字按钮。

| 操作 | 图标 | 说明 |
|------|------|------|
| 预览 | `Eye` | 图片 → `EcomImagePreviewDialog`；视频 → `EcomVideoPreviewDialog` |
| 下载 | `Download` | `downloadMediaUrl()`（`lib/ecom-media-download.ts`） |
| 删除 | `Trash2` | 可选；须 `doubleConfirm`（含 OSS 说明） |

### 唯一组件

```tsx
<EcomMediaLibraryTile
  kind="image" | "video"
  src={ossUrl}
  thumbnailSrc={thumbnailUrl}
  onPreview={() => …}
  onDownload={() => void downloadMediaUrl(url, filename)}
  onDelete={() => …}  // 可选
/>
```

悬停层样式（**全站统一**，模板区 / 资产库 / 模特库 / 模块结果区相同）：

```tsx
"absolute inset-0 flex items-center justify-center gap-2"
"bg-black/0 opacity-0 group-hover:bg-black/45 group-hover:opacity-100"

// 预览 Eye（主操作）
ECOM_MEDIA_TILE_PREVIEW_BTN_CLASS   // h-10 w-10 rounded-full bg-white/95 shadow-md
ECOM_MEDIA_TILE_PREVIEW_EYE_CLASS   // h-5 w-5

// 下载 / 删除 / 展示到 AI 空间（次要操作，可与预览并列）
ECOM_MEDIA_TILE_ACTION_BTN_CLASS    // h-8 w-8
ECOM_MEDIA_TILE_ACTION_ICON_CLASS   // h-4 w-4
```

**禁止** 按页面单独放大预览钮（如模板区 2× Eye）；须复用上述 export。

**禁止** 在缩略图下方用文字链接触发预览/下载。

### 视频缩略：封面 + 悬停自动播放

`kind="video"` 且 `thumbnailSrc` 是**真实封面图**（与 `src` 不同）时：

- 静态显示封面 `<Image>`，**不加载视频**
- 悬停才挂载 `EcomVideoHoverPreview`（静音循环播放），移出即卸载
- 无封面（`thumbnailSrc` 缺省或等于 `src`）时回退 `EcomVideoThumb` 取帧

**禁止** 在列表里直接把 mp4 交给 `<video>` 当缩略图——整屏视频同时预载会拖垮长列表。
模板区视频的封面来自导入时上传的 `{id}-thumb.webp`。

## 缩略图槽位

### 标准方 thumb（参考图条、助手栏等 · 非资产库网格）

```tsx
<div className="relative h-24 w-24 overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
  <Image src={url} alt={label} fill className="object-cover" unoptimized />
</div>
```

- 比例：**正方形**；内容 `object-cover`
- 可选底部标签：`absolute bottom-0 bg-black/55 text-[10px] text-white truncate`

### 小 thumb（助手栏参考图 56px）

```tsx
"relative h-14 w-14 overflow-hidden rounded-md border border-[#d2d2d7] bg-white"
```

### 结果卡片（竖版分镜/视频）

```tsx
"relative overflow-hidden rounded-xl border border-[#e8e8ed] bg-[#f5f5f7]"
// 有内容：aspect-[9/16] max-h-[220px]，Image object-contain
```

- 生成中：居中 `Loader2` + `text-sm text-[#6e6e73]`

## 点击预览

| 类型 | 组件 |
|------|------|
| 图片 | `EcomImagePreviewDialog` |
| 视频 | `EcomVideoPreviewDialog` + `EcomVideoPlayer` |

### 图片预览 Dialog

- 内容区：`max-h-[80vh] overflow-auto rounded-lg bg-[#f5f5f7]`
- 图：`mx-auto w-full object-contain`；先缩略后原图 crossfade（见 §懒加载）
- 标题：`DialogTitle` 显示资产名/镜头号

**禁止**新窗口 `window.open` 或未封装的原图弹层。

### 视频预览 Dialog（与 Canvas 弹层一致）

`EcomVideoPreviewDialog` 内 **`EcomVideoPlayer`** 须：

- `frameless` — 无外圆角框，原生 controls 贴边
- `adaptiveBackdrop` — 按视频比例自适应（最大 `96vw` × `calc(100dvh - 88px)`），模糊封面背景
- `autoPlay` + `poster={thumbUrl}`（有封面时）

详见 `VIDEO.md`。

## 参考图上传（StoryboardRefUploader 模式）

全站上传交互以此为准，新模块复用或抽组件。

### 分类块

每组（产品/角色/场景）一个 bordered 块：

```tsx
"rounded-lg border px-2.5 py-2 transition-colors"
// 默认：border-[#e8e8ed] bg-[#fafafa]
// 助手建议当前步：border-[#1d1d1f]/25 bg-white
// 鼠标悬停（粘贴目标）：border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]/40
```

### 标题行

- 左：分类名 `text-xs font-semibold text-[#1d1d1f]`
- 悬停时副文案「粘贴至此」`text-[10px] text-[#0071e3]`
- 右：**上传按钮** = `EcomButtonSecondary size="sm"` + **`Plus` 图标** `h-3 w-3` + 文案「上传」

```tsx
<EcomButtonSecondary size="sm" className="h-7 px-2 text-[10px]">
  <Plus className="h-3 w-3 shrink-0" />
  上传
</EcomButtonSecondary>
```

### 交互

| 行为 | 说明 |
|------|------|
| 点击上传 | 触发 hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>` |
| 粘贴 | 全局 `paste` 监听；**鼠标悬停**在某分类块上时粘贴归入该 role |
| 删除 | 角标 `X` 圆形黑底按钮；须 `doubleConfirm`（含 OSS 时第二次说明云端） |
| 空列表 | 显示 `--` `text-[10px] text-[#86868b]` |

### 分区标题（整块）

```tsx
"text-xs font-medium uppercase tracking-wide text-[#6e6e73]"  // 如「素材图」
```

辅助：`text-[10px] text-[#86868b]`「鼠标移入分类后粘贴」

## 卡片浮层操作图标（生图槽位 / 分镜结果）

悬停在结果图上的圆形按钮：

| 用途 | 样式 |
|------|------|
| 重新生成 | `rounded-full bg-black/55 text-white shadow` + `RefreshCw` |
| 预览/播放 | `rounded-full bg-white/95 text-[#1d1d1f] shadow` + `Eye` / 播放图标 |
| 下载 | `rounded-full bg-white/95 text-[#1d1d1f] shadow` + `Download` |
| 主行动（生成视频） | `rounded-full bg-[#1d1d1f] text-white shadow` |

预览 Eye：`ECOM_MEDIA_TILE_PREVIEW_*`（`h-10` / `h-5`）。其它圆形钮：`h-8 w-8`，图标 `h-4 w-4`。**禁止** 浮层内文字标签。

## 完整分镜图 / 导出预览

- 列表缩略：`StoryboardSheetLiveThumb` 缩放 `StoryboardProSheetView`
- 大图预览：`StoryboardSheetPreviewDialog`
- 导出隐藏 DOM：屏幕外 `fixed -left-[9999px]`，勿让用户看到双份 UI

### 导出版参考图区（Pro Sheet）

三列分组标题：**产品图 | 角色图 | 场景图**；同 role 多图横排在该标题下，**禁止**无标题的第四列漂浮。

- 单图格：`88×88`，描边 `1px solid #1d1d1f`
- 空位文案：「待上传」

## 产品摄影阴影

仅强调产品主体时用 `.ecom-product-shadow`（`globals.css`），**不**用于 UI 卡片。

## 禁止

- 资产库用大卡片 + 底部「删除」文字链（须 `EcomMediaLibraryTile` + 悬停图标）
- 缩略槽内拉伸变形（须 `object-cover` 或 `object-contain` 明确选型）
- 上传区仅用纯文字链接、无 `Plus` 与边框块
- 参考图删除单次确认即调 API
- 预览/下载用 `window.open` 或未封装的弹层

## 懒加载与加载态（强制）

> 交互参考 **QuickReplica** 画廊（`qr-world-browse-panel` · `qr-skeleton` · `qr-world-load-progress`）；电商工具箱为 **浅色变体**。

### 适用页面

凡 **图片 / 视频列表或网格**（模特库、模板区、我的资产、模块结果区、资产 picker 等），须遵守本节。

### 1. 缩略图（单张）

统一走 **`EcomMediaLibraryTile`**（或在其之上封装业务角标，如 `EcomTemplateGalleryTile`）：

- 视口外：**不请求**媒体；显示 **`ecom-skeleton`** 占位
- 进入视口后：`loading="lazy"` 加载；**加载完成前** skeleton 覆盖
- **OSS 列表缩略**：有 **`thumbUrl`**（导入预生成 `-thumb.webp`）时 **直接用它**；否则 `buildEcomOssThumbUrl`（模特库等 · 宽 480 WebP 动态处理）
- **预览弹层**：`EcomImagePreviewDialog` — 固定画框（如 `aspectRatio="3:4"`）→ 先 `thumbSrc` / 动态缩略 → 原图 `src` 加载后 **500ms crossfade**；失败保留缩略图
- 实现：`useIntersectionVisible` + `onLoad` / `onLoadedData`；处理失败时回退原 URL

```tsx
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";

<EcomMediaLibraryTile kind="image" src={ossUrl} alt={title} onPreview={…} />
// 非方图：aspectClass="aspect-[3/4]"
```

**禁止** 列表内裸 `<Image src={ossUrl}>` 拉全尺寸原图。

### 2. 滚动分页（画廊 / 长列表）

条目数 **> 36**（或可预见超过一屏）时 **必须** 滚动分批渲染，禁止一次性 mount 全部 DOM。

| 能力 | 用法 |
|------|------|
| 分页 Hook | `useEcomScrollPagination({ total, resetKey, pageSize? })` |
| 底部加载态 | `EcomScrollLoadFooter`（sentinel + 加载中骨架行 + indeterminate 进度条） |
| 首屏 / 接口 loading | `EcomMediaSkeletonGrid` |

```tsx
const { scrollRef, sentinelRef, visibleCount, hasMore, loadingMore, pageSize } =
  useEcomScrollPagination({ total: items.length, resetKey: filterKey });

<div ref={scrollRef} className="… overflow-y-auto …">
  <ul>{items.slice(0, visibleCount).map(…)}</ul>
  <EcomScrollLoadFooter
    sentinelRef={sentinelRef}
    hasMore={hasMore}
    loadingMore={loadingMore}
    gridClass={GRID_CLASS}
    skeletonAspect="square" // 或 "3/4"
    skeletonCount={Math.min(pageSize, items.length - visibleCount)}
  />
</div>
```

**加载中须同时满足：**

1. 底部 **骨架卡片行**（`EcomMediaSkeletonGrid` / `ecom-skeleton`）
2. **Indeterminate 进度条**（`ecom-upload-progress ecom-upload-progress-indeterminate`）
3. 文案「加载中…」；顶栏计数含「正在加载… X / Y」
4. `aria-live="polite"` + `aria-busy={loadingMore}`

空闲时底部显示「向下滚动加载更多…」。

### 3. 模板区 · 预生成缩略图（导入）

模板区 **须** 在导入时用 **sharp** 生成独立 `-thumb.webp` 上传 OSS，Catalog 存 **`thumbUrl` + `ossUrl`**（原图）。列表只请求 `thumbUrl`，避免 OSS 动态处理费用与全图流量。

```bash
cd book-mall
pnpm ecom:import-template-gallery -- --category shoes             # 原图预览 + webp 缩略图
pnpm ecom:import-template-gallery -- --file "tmp/pic/帽子.html"    # 按文件名推断分类
pnpm ecom:import-template-gallery -- --category kids --media video
pnpm ecom:import-template-gallery:thumbs -- --category shoes      # 仅为已有 ossUrl 补 thumb
```

`--category` 接受任意已登记分类（见 `e-commerce-toolkit/lib/ecom-template-gallery/types.ts`）；不传时脚本会列出全部可选值。
去重与 id 生成以 **库** 为准且与页面导入共用 `parseTemplateGalleryHtml` / `importTemplateGalleryItem`，故两条线不会产生重复条目；已传过的对象靠 OSS 存在性探测跳过，`--skip-known` 可连探测一并省掉。

实现：`book-mall/lib/ecom/ecom-gallery-thumb.ts` · `uploadEcomTemplateGalleryThumb` · key `{id}-thumb.webp`。

**模特库** 可继续仅用 `buildEcomOssThumbUrl` 动态缩略，不必预生成。

### 4. 首屏 / 接口等待

远程拉取列表时 **禁止** 仅文字「加载中…」；须 `EcomMediaSkeletonGrid`（或同等骨架），网格密度与正式列表一致。

### 5. CSS

- 占位：`ecom-skeleton`（`globals.css`，浅色 shimmer）
- 进度：`ecom-upload-progress-indeterminate`

### Code Review

- 长画廊无 `useEcomScrollPagination` → 驳回
- 滚动加载无 skeleton + 进度条 → 驳回
- 缩略图无 `EcomMediaLibraryTile` / 无 skeleton → 驳回
