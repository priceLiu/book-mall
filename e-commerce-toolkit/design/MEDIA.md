# 电商工具箱 · 图片、上传与预览

> 母规范：`SYSTEM.md` §8。视频见 `VIDEO.md`。

## 缩略图槽位

### 标准方 thumb（资产库、步骤结果、参考图条）

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
- 图：`mx-auto w-full object-contain`
- 标题：`DialogTitle` 显示资产名/镜头号

**禁止**新窗口 `window.open` 或未封装的原图弹层。

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

## 卡片浮层操作图标

悬停在结果图上的圆形按钮：

| 用途 | 样式 |
|------|------|
| 重新生成 | `rounded-full bg-black/55 text-white shadow` + `RefreshCw` |
| 预览/播放 | `rounded-full bg-white/95 text-[#1d1d1f] shadow` + 对应图标 |
| 主行动（生成视频） | `rounded-full bg-[#1d1d1f] text-white shadow` |

尺寸：`h-8 w-8` 或 `h-9 w-9`，图标 `h-3.5~4 w-3.5~4`。

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

- 缩略槽内拉伸变形（须 `object-cover` 或 `object-contain` 明确选型）
- 上传区仅用纯文字链接、无 `Plus` 与边框块
- 参考图删除单次确认即调 API
