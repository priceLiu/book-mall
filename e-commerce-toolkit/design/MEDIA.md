# 电商工具箱 · 图片、上传与预览

> 母规范：`SYSTEM.md` §8。视频见 `VIDEO.md`。  
> **全站须按本文组件映射实现**；禁止各模块自写缩略图、预览弹层或上传条。

---

## 0. 统一组件映射（强制）

凡涉及 **图片展示 / 弹出层预览 / 上传与从资产库选取**，须用下表组件，**禁止**复制布局或另起 Dialog。

| 场景 | 唯一组件 | 路径 |
|------|----------|------|
| **资产库 / 模块结果网格** | `EcomMediaLibraryTile` | `components/media/ecom-media-library-tile.tsx` |
| 网格容器 class | `ECOM_LIBRARY_MEDIA_GRID_CLASS` | 同上 export |
| **单张图片放大预览** | `EcomImagePreviewDialog` | `components/media/ecom-image-preview-dialog.tsx` |
| **多张图片轮播预览**（成图槽位画廊） | `ProductDesignGalleryPreviewDialog` | `components/product-design/product-design-gallery-preview-dialog.tsx` |
| **参考图上传卡片** | `EcomRefUploadCard` | `components/media/ecom-ref-upload-card.tsx` |
| **上传区 56px 缩略** | `EcomRefImageThumb` | `components/media/ecom-ref-image-thumb.tsx` |
| **从「我的资产」选取** | `EcomAssetPickerDialog` | `components/media/ecom-asset-picker-dialog.tsx` |
| 下载 | `downloadMediaUrl()` | `lib/ecom-media-download.ts` |
| OSS 列表缩略 | `buildEcomOssThumbUrl()` | `lib/ecom-oss-image-url.ts` |
| 滚动分页 | `useEcomScrollPagination` + `EcomScrollLoadFooter` | `lib/use-ecom-scroll-pagination.ts` 等 |

### 业务封装（薄包装，禁止改 UI）

各模块 **只** 传 props / 调 API，**不得** 重写卡片 DOM：

| 模块 | 封装 | 说明 |
|------|------|------|
| 微剧故事版 | `StoryboardRefUploader` | 产品 / 角色 / 场景 三卡 + `EcomAssetPickerDialog` |
| 电商主图 / 详情 | `ProductDesignRefUploader` | 按 `role` 单卡 |
| 手伴创作 | `HandCraftRefUploader` | 线稿区；可选 `toolbarPrefix`（生成线稿） |
| 种草视频 | `SeedVideoRefUploader` | 素材区 |
| 拆图拆视频 | `MediaDecomposeMediaInput` | 单素材：`EcomRefUploadCard`（图片/视频）+ `toolbarPrefix` 粘贴 HTTPS 链接 + `EcomAssetPickerDialog`（`allowVideo`） |

新增模块参考图上传 → **必须先** 用 `EcomRefUploadCard` +（可选）`EcomAssetPickerDialog`，再写薄封装。

**拆图拆视频**（`components/media-decompose/media-decompose-media-input.tsx`）与主图 / 种草共用 `EcomRefUploadCard`（我的资产 + 上传 + 拖放粘贴）。额外用 `toolbarPrefix` **粘贴链接** 展开 HTTPS 输入；URL 经 `POST .../media/from-url` 服务端校验并转存 OSS。视频缩略走卡片内 56px 槽，预览用 `EcomVideoPreviewDialog`（见 `VIDEO.md`）。

---

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

### 选择模式（资产 Picker · 强制）

`EcomAssetPickerDialog` 及一切「多选入库」场景：

```tsx
<EcomMediaLibraryTile
  kind="image"
  src={thumbUrl}
  selected={active}
  onSelect={() => toggle(id)}
  onPreview={() => setPreviewSrc(url)}
/>
```

| 规则 | 说明 |
|------|------|
| 点击缩略图主体 | `onSelect` 切换选中；右上角蓝底 `Check` |
| 悬停 Eye | `onPreview` → **`EcomImagePreviewDialog`**（与资产库一致） |
| 遮罩层 | 未悬停时 **`pointer-events-none`**，不得挡住选中点击 |
| 已选上限 | Picker 传 `maxSelect`；底栏「使用所选 N 张」 |

**禁止** Picker 内自写网格卡片或裸 `<Image onClick>`。

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

## 点击预览（图片 · 强制）

| 类型 | 组件 | 何时使用 |
|------|------|----------|
| **单张** | `EcomImagePreviewDialog` | 资产库、模板区、Picker Eye、分镜单图 |
| **多张轮播** | `ProductDesignGalleryPreviewDialog` | 手伴 / 主图槽位「画廊预览」、同组多成图切换 |

### 单张：`EcomImagePreviewDialog`

全站统一 **全屏暗底 lightbox** + **滚轮缩放 / 拖拽平移**（见 `.cursor/rules/image-preview-zoom-pan.mdc`）：

- 容器：`h-[100dvh] w-screen bg-black/90 border-0`
- 先 OSS 缩略占位 → 原图加载后 crossfade；加载中 indeterminate 进度条
- 右下角 `ImageZoomControls`（须与缩放 stage **兄弟节点**，不可包在 `scale` 内）
- 关闭：Esc、右上圆形关闭钮、点击空白
- `<img draggable={false}>` + stage `onDragStart` preventDefault

```tsx
<EcomImagePreviewDialog
  src={ossUrl}
  thumbSrc={thumbnailUrl}
  open={open}
  onOpenChange={setOpen}
  title="资产名或镜头号"
/>
```

**禁止** `window.open`、白底小窗、或无缩放的手写弹层。

### 多张：`ProductDesignGalleryPreviewDialog`

- 全屏黑底 `bg-black/95`；顶栏标题 + 可选「下载」
- 左侧主图 `object-contain`；右侧竖条缩略条（`items.length > 1`）
- 键盘 `←` / `→` 切换；**不含**滚轮缩放（成图审查场景）

### 参考条悬停浮层：`EcomRefImageThumb`

上传区 56px 缩略 **不** 走 Dialog；悬停 portal 浮层（`z-[400]`）：

- 尺寸：`EcomRefUploadCard` 内 `size={56}`
- 角标删除：黑底圆形 `X`；删除须 `doubleConfirm`（含 OSS 说明）
- 浮层：`rounded-xl border shadow-xl`，图 `object-contain max-h-64`

---

## 参考图上传（`EcomRefUploadCard` · 强制）

全站上传交互 **唯一** 卡片组件；微剧 / 主图 / 手伴 / 种草均复用。

### 卡片容器

```tsx
"rounded-lg border px-2.5 py-2 outline-none transition-colors"
// 默认：border-[#e8e8ed] bg-white
// 助手建议当前步（微剧）：border-[#0071e3]/45 ring-1 ring-[#0071e3]/15
// 拖放 / 粘贴目标：border-[#0071e3] bg-white ring-1 ring-[#0071e3]/30
```

### 标题行

- 左：分类名 `text-xs font-semibold text-[#1d1d1f]`
- 拖放中副文案：`可拖放 / Ctrl+V 粘贴` · `text-[10px] text-[#0071e3]`
- 右：**工具钮组**（`flex gap-1.5`，均为 `EcomButtonSecondary size="sm" className="h-7 px-2 text-[10px]"`）

| 顺序 | 按钮 | 图标 | 说明 |
|------|------|------|------|
| 可选前缀 | `toolbarPrefix` | 模块自定 | 如手伴「生成线稿」、拆图「粘贴链接」 |
| 1 | **我的资产** | `Images` `h-3 w-3` | 打开 `EcomAssetPickerDialog`；达上限时隐藏 |
| 2 | **上传** | `Plus` `h-3 w-3` | 触发 hidden file input |

```tsx
<EcomRefUploadCard
  title="产品图"
  items={items}
  emptyHint="…"
  busy={busy}
  uploadProgress={progress}
  onUploadFiles={handleFiles}
  onOpenFilePicker={() => inputRef.current?.click()}
  onOpenAssetPicker={() => setPickerOpen(true)}
  onRemove={handleRemove}
  inputRef={inputRef}
/>
```

### 交互

| 行为 | 说明 |
|------|------|
| 点击上传 | 默认 `accept="image/jpeg,image/png,image/webp"` · `multiple`；拆图可覆盖 `accept` / `multiple={false}` / `allowVideo` |
| 拖放 / 粘贴 | `useImageDropPaste`；悬停块上粘贴归入该 role |
| 上传进度 | `ecom-upload-progress` + `text-[10px] text-[#0071e3]` |
| 空列表 | `emptyHint` · `text-[10px] text-[#86868b]` |
| 已有图 | `EcomRefImageThumb` 横排 `gap-1.5` |

### 分区标题（整块上方）

```tsx
"text-xs font-medium uppercase tracking-wide text-[#6e6e73]"  // 如「素材图」
"text-[10px] text-[#86868b]"  // 计数 · 拖放提示
```

---

## 从「我的资产」选择（`EcomAssetPickerDialog` · 强制）

上传区「我的资产」钮 **必须** 打开本 Dialog，**禁止** 跳转 `/library` 或自写列表。

### 结构

- Radix `Dialog` · `max-w-3xl` · `max-h-[85vh]`
- 顶栏：「从我的资产选择」+ 已选 / 上限
- 分组 Tab：`rounded-full` 胶囊（选中 `bg-[#1d1d1f] text-white`）
- 内容：`ECOM_LIBRARY_MEDIA_GRID_CLASS` + **`EcomMediaLibraryTile` 选择模式**
- 底栏：`EcomButtonSecondary` 取消 + `EcomButtonPrimary`「使用所选 N 张」

### 分组（与资产库 module 一致）

`main-image` · `detail-page` · `model-shot` · `storyboard-micro-drama` · `hand-craft` · `seed-video`

### 挂载 API（各模块须实现）

| 模块 | 挂载方式 |
|------|----------|
| 微剧故事版 | `POST .../storyboard/projects/[id]/references/attach` |
| 电商主图/详情 | `updateProductDesignProject` · 按 **当前 role** 追加 |
| 手伴 | `POST .../hand-craft/projects/[id]/refs/attach` |
| 种草视频 | `POST .../seed-video/projects/[id]/refs/attach` |

Picker 默认只选 **`kind === "image"`** 资产；`maxSelect` = 剩余可上传张数。拆图拆视频传 `allowVideo`，可选图片或视频。

---

## 参考图上传（旧模式 · 已废弃）

~~StoryboardRefUploader 内联 DOM~~ → 已改为 **`EcomRefUploadCard` 组合**。新代码 **禁止** 复制旧版 `bg-[#fafafa]` 单「上传」钮布局。

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
- 上传区仅用纯文字链接、无 **我的资产 + Plus 上传** 双钮（须 `EcomRefUploadCard`）
- 上传区「我的资产」只展示 UI 不挂 `EcomAssetPickerDialog` + 挂载 API
- Picker / 网格内自写缩略卡片（须 `EcomMediaLibraryTile`）
- 选择模式下遮罩层拦截点击（须 `pointer-events-none` 至 hover）
- 参考图删除单次确认即调 API
- 预览/下载用 `window.open` 或未封装的弹层
- 单图预览不用 `EcomImagePreviewDialog`（须含缩放平移规范）

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
- 参考上传未走 `EcomRefUploadCard` → 驳回
- 「我的资产」未走 `EcomAssetPickerDialog` → 驳回
- 图片预览未走 `EcomImagePreviewDialog`（单张）→ 驳回
