# 漫剧画布 · 设计规范

canvas-web 漫剧工作流的 **固定尺寸、布局、按钮、弹层、文案显示、编辑模式、对比图** 约定。实现时以代码常量为真源；改尺寸须同步更新本文与 `normalize-graph-nodes.ts` / `NODE_DEFAULT_SIZE`。

相关文档：[story-eng.md](./story-eng.md) · [story-ops.md](./story-ops.md)

---

## 1. 尺寸常量（真源）

| 常量 | 值 | 文件 |
|------|-----|------|
| `STORY_CONTROL_NODE_WIDTH` | **1020** | `lib/canvas/story-node-chrome.ts` |
| `STORY_CONTROL_NODE_HEIGHT` | **1200** | 同上 |
| `NODE_DEFAULT_SIZE["story-video-column"]` | **500 × 2100** | `lib/canvas/types.ts` |
| `NODE_DEFAULT_SIZE["story-frame-column"]` | **1080 × 2100** | 同上 |
| `NODE_DEFAULT_SIZE["story-character-column"]` | **560 × 2100** | 同上 |
| `NODE_DEFAULT_SIZE["jianying-export"]` | **400 × 280** | 同上 |
| `NODE_DEFAULT_SIZE["three-view-engine"]` | **670 × 880** | 同上 |
| `NODE_THREE_VIEW_MIN_*` | 670 × 880 | `components/canvas/node-ui.tsx` |
| `STORY_ROW_LABEL_COL_WIDTH` | **56** | `lib/canvas/story-ref-image.ts` |
| `STORY_UPSTREAM_COL_WIDTH`（参考图） | **220** | 同上 |
| `STORY_MEDIA_COL_WIDTH`（分镜/角色输出图） | **248** | 同上 |
| `MEDIA_COL_MIN` / 行媒体最小高 | **248** | `lib/canvas/story-column-layout.ts` |
| `STORY_COLUMN_VIEWPORT_H` | **2100** | 同上（与分镜列固定高对齐） |

### 1.1 控制节点（故事主题 + 故事大纲）

- 类型：`story-comic-starter`、`story-script-hub`
- **固定 1020 × 1200**，二者同宽同高
- 禁止按内容动态撑高节点外框；内容在预览区 **flex-1 内滚**，底栏 **固定不滚**
- 加载 / 重排 / migrate 须写回上述尺寸（见 `normalizeStoryControlNodeSizes`、`applyStoryControlRowHeights`）

### 1.2 三视图节点

- 类型：`three-view-engine`
- **固定 670 × 880**（Prompt 上 · 三视图下）
- 持久化尺寸偏差过大时 normalize 收拢到默认

### 1.3 角色列 + 分镜脚本列（图 2 工作区）

- **角色列** `story-character-column`：**560 × 2100**
- **分镜列** `story-frame-column`：**1080 × 2100**
- **分镜视频列** `story-video-column`：**500 × 2100**
- 宽度不变；**禁止**再按 rows 内容动态撑节点外框高
- 行列表在 `NodeShell bodyScroll` 内滚动；底栏批量按钮固定
- 行内列宽：标签 56 · 提示词 flex-1 · 参考图 220 · 输出图 248
- 加载 / 重排 / migrate 须写回上述尺寸（`normalizeStoryMediaColumnSizes`、`storyCharacterColumnSize` / `storyFrameColumnSize` 仅返回默认宽高）

### 1.4 剪映导出节点

- 类型：`jianying-export`
- **固定 400 × 280**
- 每套工作流 **独立** 创建，数据字段 `hubNodeId` 绑定所属故事大纲
- 连线：本分镜视频列 → 本剪映导出；旧工作流的剪映 **不可复用**

### 1.5 工作区横向重排（多工作流）

真源：`lib/canvas/story-workspace-layout.ts` · `lib/canvas/story-comic-workspace-layout.ts`

- 列间距 `STORY_WORKSPACE_COL_H_GAP = 120`
- 控制行：主题 `x` → 大纲 `x + 1020 + 120`
- 媒体列 X（从大纲左缘起）：  
  `hubLeftX + 1020 + 120`，再依次 + `(列宽 + 120)`  
  列宽序列：**560 · 1080 · 500 · 400**（角色 · 分镜 · 视频 · 剪映）
- 媒体列 Y：**底对齐** 控制行底边（1200 高）  
  `y = controlRowBottom - columnHeight`（2100 高列显著上探）
- **剪映导出** Y：**顶对齐** 故事主题/大纲（与 `originY` 相同；三列媒体仍为底对齐控制行底）
- **每套** `story-comic-starter` 独立 `reflowStarterChain`，互不覆盖
- 步进宽度取 `style.width`、RF measured、类型默认的 **最大值**，避免重叠

---

## 2. 节点壳布局

所有带底栏的漫剧节点统一结构：

```text
┌─ NodeShell header ─────────────────────┐
├─ 区块标签（蓝色提示，见 §8）        │
├─ flex-1 min-h-0 预览/列表区（overflow-y）│
├─ STORY_NODE_SHELL_FOOTER_CLASS ────────┤
│   · 可选 EnginePicker 区（故事主题）     │
│   · StoryNodeFooterShell               │
│     ├ 主按钮 h-9 (36px)                │
│     └ 提示行 h-4 (16px，无文案也占位)   │
└────────────────────────────────────────┘
```

共享类名（`story-node-chrome.ts`）：

- `STORY_NODE_SHELL_FOOTER_CLASS` — 底栏容器
- `STORY_NODE_PREVIEW_SCROLL_CLASS` — 预览滚动区
- `STORY_NODE_ENGINE_DOCK_CLASS` — 故事主题 LLM 选择区（不进滚动）

---

## 3. 按钮

### 3.1 漫剧主操作（橙实心）

- 常量：`STORY_ORANGE_BTN_CLASS`（`story-column-batch-footer.tsx`）
- 色：`#fb923c` / hover `#fdba74`；**禁用时不变暗**（保持可读）
- 高度：**h-9（36px）**，字号 12px
- 用法：
  - 节点底栏全宽：`STORY_NODE_ACTION_BTN_CLASS`
  - 大纲双按钮并排：`STORY_NODE_ACTION_BTN_SPLIT_CLASS`
  - 三列批量：`StoryColumnBatchFooter`

### 3.2 引擎节点主按钮

- `NODE_BTN_ENGINE_PRIMARY`（`node-ui.tsx`）— 与漫剧橙同色

### 3.3 弹层顶栏

| 类型 | 样式 |
|------|------|
| Tab 选中 | `bg-[#fb923c]/25 text-[#fdba74]` |
| Tab 未选 | `text-white/60 hover:bg-white/10` |
| 保存（实心） | `bg-[#fb923c] text-black`，未改时 `disabled:opacity-40` |
| 生成 / 重新生成 | 描边 `border-[#fb923c]/50 bg-[#fb923c]/15 text-[#fdba74]` |
| 关闭 | 圆形 `border-white/10`，X 图标 |

### 3.4 列内媒体操作（圆形浮层）

- 生成 / 重生成：`size-9`，橙描边 `border-[#fb923c]/40`
- 预览：`size-9`，白描边 `border-white/20`
- 分镜视频快捷：`size-8` 右下角 Clapperboard
- 生成中：中央 `RefreshCw` 旋转 + `canvas-story-media-generating` 橙边

### 3.5 放大镜预览

- 组件：`StoryPreviewMagnifyButton`
- 标题栏：`onDark` — 橙底描边 28×28
- 白纸预览 hover：`onLight` — 白底橙字
- 预览纸 hover  overlay：居中 44×44 圆 + Search 图标

---

## 4. 弹出层

### 4.1 通用遮罩

| 用途 | z-index | 背景 |
|------|---------|------|
| 审阅弹层 / Word 全屏 / 对比 | **1100** | `bg-neutral-600/90 backdrop-blur-sm` 或 `bg-black/92~94` |
| EnginePicker 下拉 | 1200 | — |

- `createPortal` 挂 `document.body`
- 打开时 `document.body.style.overflow = hidden`
- `Escape` 关闭；审阅弹层点击遮罩关闭
- 内容区加 `nodrag` / `stopPropagation`，避免拖动画布

### 4.2 双栏审阅弹层（故事主题 / 故事大纲）

组件：`StoryThemePromptModal`、`StoryScriptHubModal`

```text
顶栏：标题 + Tab + 保存状态 + 操作 + 关闭
正文：max-w-[min(96vw,1400px)] grid-cols-2 白底卡片
  左 · 编辑   │ 右 · 原稿/预览
  sticky 栏   │ sticky 栏
  DOC_PAD     │ DOC_PAD + MarkdownView document
```

- 左右 **等高**：右侧 `ResizeObserver` 量高，左侧 `minHeight` 对齐
- 故事主题顶栏 Tab：**模板一 / 模板二 / … / 自定义**（不在节点上放 Tab）
- 故事大纲顶栏 Tab：**故事大纲 / 角色设定 / 分镜脚本 / 对白**

### 4.3 Word 式全屏阅读

组件：`MarkdownFullscreenLightbox`

- 居中纸页：`max-w-[820px]`，`px-10 py-12 sm:px-14 sm:py-16`
- `MarkdownView variant="document"`

### 4.4 媒体预览

- 单图/视频：`StoryMediaPreviewModal` — 黑底居中，`max-w-[min(96vw,960px)]`
- 带 Prompt 侧栏：`MediaHoverBox` 预览弹层（分镜图可左 Prompt 右图）

---

## 5. 文案显示（Markdown）

### 5.1 MarkdownView 变体

| variant | 场景 | 排版 |
|---------|------|------|
| `document` | 弹层右栏、Word 全屏 | 17px / leading 1.75，prose-neutral 深字 |
| `nodePreview` | 故事大纲节点白纸预览 | 13px，浅灰底 `neutral-50` |
| `darkPreview` | 故事主题节点黑底预览 | 13px，prose-invert 白字 |
| `inline` | 引擎节点内嵌 | 12px 暗色 |

### 5.2 节点内预览纸

| 节点 | 背景 | 组件 |
|------|------|------|
| 故事主题 | **黑底** `bg-black` | `StoryThemePromptPreviewPane` |
| 故事大纲 | **白纸** `bg-neutral-50` | `StoryHubNodePreviewPane` |

- 有内容：整纸可点 → 打开审阅弹层；hover 橙边 + 居中放大镜
- 无内容：虚线框 + 居中提示，不可打开

### 5.3 GFM 表格

- 统一 chrome：`lib/canvas/story-md-table-chrome.ts`
- 预览/编辑同款：外框 `border-neutral-300`，表头 `bg-neutral-100`，单元格 `bg-white`
- document：`15px` + `px-4 py-2.5`；nodePreview：`12px` + `px-2.5 py-1.5`
- 角色/分镜默认可解析为表格编辑，见 §6

---

## 6. 编辑模式

### 6.1 故事主题

- 节点：只读预览；编辑仅在 `StoryThemePromptModal`
- 左栏：`textarea`，`DOC_TEXT`（17px sans，`leading-[1.85]`）
- 模板 Tab 切换载入模板正文；改动后保存可落为自定义

### 6.2 故事大纲审阅

| 段 | 默认编辑 | 可切换 |
|----|----------|--------|
| 故事大纲 | **块级渲染编辑** `StoryOutlineDocumentEditor` | Markdown 源码 |
| 角色设定 | **表格** `StoryCharacterTableEditor` | Markdown 源码 |
| 分镜脚本 | **表格** `StoryStoryboardTableEditor` | Markdown 源码 |
| 对白 | 按镜号 textarea 列表 | 只读依赖分镜表 |

- LLM **首次「创作剧本」** 须按 `story-prompts.ts` · `STORY_PACK_MARKDOWN_STRUCTURE` 一次输出 **起承转合 + ## 角色设定 + ## 分镜脚本** GFM 表；落库时 `promoteEmbeddedPackFromOutline` 自动拆入各 Tab（对白来自分镜表「台词」列）。

- 大纲/角色/分镜支持 **历史版本** 下拉恢复
- 单段 **生成 / 重新生成** LLM；保存写入 hub node data
- **禁止**在 UI 弹黄色台词/角色名警告（约束写在 prompt）

### 6.3 分镜列行编辑

- 提示词：`MentionsTextarea`，支持 `@<ref-char-*>` 引用角色三视图
- 600ms debounce 写回 `rows`
- 参考图列只读展示上游；输出图列生成/预览/分镜视频

### 6.4 文案编辑 UX 铁律（致命，必守）

> **左侧必须能「看到渲染」再编辑；禁止默认整篇 Markdown 源码；禁止引入未验证的 WYSIWYG 导致白屏崩溃。**

#### 6.4.1 编辑入口一览（真源组件）

| 入口 | 组件 | 节点外壳 | 左栏默认 | 右栏 / 预览 |
|------|------|----------|----------|-------------|
| 故事大纲审阅 | `StoryScriptHubModal` | `StoryHubNodePreviewPane` · 只读 | 见 §6.2 各 Tab | `MarkdownView` · `document` |
| 故事主题 | `StoryThemePromptModal` | `StoryThemePromptPreviewPane` · 只读 | `textarea` / `MentionsTextarea`（系统提示词，非 GFM 剧本） | `MarkdownView` · `document` |
| Word 全屏 | `MarkdownFullscreenLightbox` | — | — | `MarkdownView` · `document` |
| 上传剧本预览 | `StoryProScriptUploadPreviewModal` | — | 只读 | `MarkdownView` · `document` |
| 引擎 LLM 输出 | `story-engine-actions-modal` | 节点内嵌 | 只读 | `MarkdownView` · `inline` |

**统一 chrome 常量**：`lib/canvas/story-hub-editor-chrome.ts`（切换按钮文案、左栏说明）。

#### 6.4.2 `StoryScriptHubModal` 各 Tab 左栏（默认模式）

| Tab | 默认左栏 | 切换按钮 | 禁止 |
|-----|----------|----------|------|
| **故事大纲** | `StoryOutlineDocumentEditor`：GFM 表 → `StoryGenericMdTableEditor`；正文 → `MarkdownView` 渲染，点段落后 **上方保持渲染**、下方 Markdown  textarea | 「切换 Markdown 源码」↔「切换渲染编辑」 | 禁止默认整篇 textarea；禁止点击段落后 **仅** 显示源码而隐藏渲染 |
| **角色设定** | `StoryCharacterTableEditor`（表格单元格可编辑，样式同预览） | 「切换 Markdown 源码」↔「切换表格编辑」 | 禁止默认可解析表时仍用 textarea |
| **分镜脚本** | `StoryStoryboardTableEditor` | 同上 | 同上 |
| **对白** | 按镜号 textarea（结构化字段，非 Markdown 文档） | — | — |

- 右栏 **始终** `MarkdownView variant="document"` 实时预览（与左侧同源 `draft`）。
- 空内容时仍进入对应编辑器（表格 Tab 可「添加行」/ 大纲可空白撰写），**不得**因 `trim()` 为空而只显示占位、隐藏编辑器。
- **节点外壳**（画布上）一律只读预览；**所有改稿仅在弹层**完成。

#### 6.4.3 表格与 Markdown 解析

- 预览 / 编辑表格样式：`story-md-table-chrome.ts`（§5.3）。
- 可编辑表：`StoryCharacterTableEditor`、`StoryStoryboardTableEditor`、`StoryGenericMdTableEditor`。
- 解析写回：`parse-md-tables.ts`；单元格展示须 `stripInlineMarkdownCell`（去掉 `**加粗**` 等，避免左侧表格显示 `**` 而右侧已渲染）。
- 列匹配：`pickColumn` **按别名优先级**（如「姓名」优先于「角色」），避免大纲人物表解析错列。

#### 6.4.4 禁止事项（曾导致生产级 UX 事故）

1. **禁止**在审阅弹层默认左侧整篇 Markdown 源码（「切换 Markdown 源码」除外）。
2. **禁止**未经隔离验证引入 Lexical / MDXEditor 等第三方 WYSIWYG（易 `removeChild` 白屏，旧项目 Markdown 挂载即崩）。
3. **禁止**编辑时让 React 与编辑器 **双向强同步** 同一份 DOM（应：挂载时初始化，编辑自治，外部换稿仅 `key` remount）。
4. **禁止**表格可解析时默认 textarea；**禁止**为表格单独写一套 prose 样式。
5. **禁止**在 UI 弹黄色角色名/台词警告（约束在 prompt，见 §6.2）。

#### 6.4.5 改编辑相关代码时的自检

- [ ] 左栏默认是否为 **渲染态 / 表格态**（非整篇源码）？
- [ ] 大纲正文编辑时 **MarkdownView 是否仍可见**？
- [ ] 右栏是否仍为 `MarkdownView document`？
- [ ] 切换按钮文案是否与 `story-hub-editor-chrome.ts` 一致？
- [ ] 空内容是否仍能进入编辑器？
- [ ] 是否更新本文 §6 与 `.cursor/rules/canvas-story-design.mdc`？

---

## 7. 参考图与对比

### 7.1 分镜行 · 上游参考图（对比参照）

- 宽 **220**，最小高 **248**
- 被 `@` 引用的图：**橙色激活框**  
  `border-[#fb923c]` + `shadow-[0_0_0_1px_#fb923c,0_0_10px_rgba(251,146,60,0.4)]`
- 未引用：`border-white/15`
- 无图占位：「待上游」/ 虚线 `—`

### 7.2 输出图列

- 宽 **248**；`object-contain` 黑底槽
- hover 显示生成/预览；分镜有图时右下角 **生视频** 钮

### 7.3 历史对比弹层（引擎节点）

组件：`CompareModal` / `CompareSplitView` / `MediaHoverBox`

- 全屏 `z-[1100]`，`bg-black/94`
- 顶栏 `CompareToolbar`：左图/右图下拉 + 步进
- 视图：**重叠 + 竖向滑块** 切分对比（非简单并排）
- 默认：主图 vs 参考图，或主图 vs 上一张任务
- 键盘：`←` / `→` 切右图，`Escape` 关闭
- 预览弹层内 Tab：**大图 | 对比**（需传入 `compareContext`）

---

## 8. 蓝色提示文案（模型 / @ 引用）

真源：`lib/canvas/story-column-sync.ts`

| 常量 | 用途 | 样式 |
|------|------|------|
| `STORY_HINT_BLUE_CLASS` | 蓝色字色 | `text-[#60a5fa]` |
| `STORY_HINT_LABEL_CLASS` | 区块标签 | 左竖线 `border-l-2 border-[#60a5fa] pl-2` + 10px uppercase 蓝字 |
| `STORY_HINT_BODY_CLASS` | 行内说明、@ 提示 | 10px `leading-relaxed` 蓝字 |

固定文案与用法：

- **故事主题** 底栏：`LLM 模型（文案共用）` → `STORY_HINT_LABEL_CLASS`
- **分镜列** 模型区：`分镜图 · IMAGE`、`分镜视频 · VIDEO` → `STORY_HINT_LABEL_CLASS`
- **镜 1 @ 提示**：`FRAME_ROW_AT_HINT` = `（输入 @ 可引用已生成的角色三视图）` → `STORY_HINT_BODY_CLASS`，显示在提示词输入框下方
- **空列表说明**、textarea placeholder「输入 @ 引用角色三视图」等同系蓝色提示

橙色 `#fb923c` **仅**用于主按钮、Tab 选中、**@ 激活的参考图边框**；操作说明与模型标签一律蓝色，勿用 muted 灰或橙字。

---

## 9. 色彩与强调

| 用途 | 色值 |
|------|------|
| 漫剧强调橙 | `#fb923c` / `#fdba74` / `#ea580c` |
| 操作提示蓝 | `#60a5fa`（见 §8） |
| 画布 muted 文案 | `var(--canvas-muted)` |
| 画布表面 | `var(--canvas-surface)` |
| 成功/未保存 | `text-emerald-300` / `text-amber-300` |

---

## 10. 功能与模块索引

| 功能 | 入口 / 模块 |
|------|-------------|
| 创作剧本 | 故事主题底栏 → 顺序生成大纲/角色/分镜 |
| 审阅保存 | 放大镜 / 预览纸 → `StoryScriptHubModal` |
| 系统提示词 | 故事主题 → `StoryThemePromptModal` |
| Word 全屏 | 弹层内或 hub 预览链 → `MarkdownFullscreenLightbox` |
| 列批量生成 | 角色/分镜/视频列底栏 `StoryColumnBatchFooter` |
| 工作区重排 | `reflowStoryComicWorkspace` |
| 尺寸迁移 | `normalizeCanvasNodes`、`migrateGraphV1ToV2` |
| 图片上传（点击/拖入/粘贴） | §13 · `image-upload-handlers.ts` · `MediaHoverBox` |

---

## 11. 修改尺寸检查清单

改任何固定尺寸时：

1. 更新 `story-node-chrome.ts` / `types.ts` `NODE_DEFAULT_SIZE` / `story-ref-image.ts` / `node-ui.tsx`
2. 更新 `story-column-layout.ts` 内 `MEDIA_COL_MIN` 等与列相关的估算
3. 更新 `normalize-graph-nodes.ts` 收拢阈值（若逻辑硬编码）
4. 更新 **本文档** §1 表格
5. 已有项目：刷新后 normalize；列位重叠则 **重排**

---

## 12. 视频播放控件（必须）

与 **tool-web 图生视频实验室** 成片播放一致；Canvas 内禁止第二套自定义控制条。

### 12.1 唯一播放组件

- 真源：[`components/canvas/canvas-video-player.tsx`](../components/canvas/canvas-video-player.tsx) · **`CanvasVideoPlayer`**
- 结构：`relative aspect-video bg-black/95` 容器 + 原生 `<video controls playsInline preload="metadata" class="h-full w-full object-contain">`

### 12.2 使用范围

| 场景 | 做法 |
|------|------|
| 节点内联播放 | `CanvasVideoPlayer`（如 `video-preview-node`） |
| 弹层全屏预览 | `StoryMediaPreviewModal` / `MediaPreviewLightbox` 内 `CanvasVideoPlayer`，`autoPlay` |
| 缩略图槽位 | 允许 **muted、无 controls** 的 `<video>` 仅作封面；点击后弹层必须用 `CanvasVideoPlayer` |

### 12.3 禁止

- 节点/弹层内自定义 seek 条、hover 才出现的控制条、或裸 `<video controls>` 绕过 `CanvasVideoPlayer`
- 与实验室不一致的播放器皮肤

### 12.4 弹层

- 视频预览弹层 z-index：**1100**（与 §6 一致）
- 弹层 header 可保留下载/关闭；**播放控件**仅走 `CanvasVideoPlayer`

---

## 13. 图片上传控件（必须）

凡 canvas-web 内 **用户可主动上传 / 替换图片** 的控件（资产槽、参考图区、图片节点、宫格参考图等），须 **同时** 支持三种入口，禁止只做「点击选文件」一种。

### 13.1 三种入口（缺一不可）

| 入口 | 行为 | 说明 |
|------|------|------|
| **点击** | 隐藏 `<input type="file" accept="image/*">` 或等效文件选择 | 空态点击区域应能直接打开选文件；有图时点击可为预览，上传仍可通过 ↑ 或 hover 后粘贴 |
| **拖入** | `dragover` + `drop`，仅接受 `image/*` | 须 `preventDefault` + `stopPropagation`，避免触发画布根级 `onDrop` 新建节点 |
| **粘贴** | 全局 `paste`（capture）或控件级监听 | 仅当粘贴内容为图片文件时拦截；**不得**抢占 textarea / input 内的文字粘贴 |

文案统一提示：**「点击 / 拖入 / 粘贴」**（多选场景可写「点击 / 拖入 / 粘贴（支持多选）」）。

### 13.2 共享实现（真源）

| 模块 | 路径 | 职责 |
|------|------|------|
| 工具函数 | `lib/canvas/image-upload-handlers.ts` | `firstImageFileFromDataTransfer`、`bindImageDragDropHandlers`、`useImagePasteWhenActive`、`isEditablePasteTarget` |
| 媒体槽 UI | `components/canvas/media-hover-box.tsx` | 可选 `onImageFile`：拖入 + 空态文案 |
| 上传 API | `lib/canvas-api.ts` · `uploadCanvasImage` | 直传 OSS；上传期间控件 `busy`，不重复提交 |

**新上传点必须先复用上述模块**，禁止各写一套 paste/drop 逻辑。

### 13.3 粘贴目标（多槽 / 多格）

存在 **多个上传目标**（如角色四槽、场景三槽、宫格 N 格）时：

1. 维护 **当前激活槽** `activeKind` / `activeSlotIndex`（`mouseEnter`、点击上传、拖入落点均可设置）。
2. 仅当激活槽存在且控件未 `disabled` / 未锁定时，`useImagePasteWhenActive(true, …)` 在 **capture** 阶段拦截 paste，避免与 `flow-canvas.tsx` 全局粘贴（新建图片节点）冲突。
3. 未激活任何槽时，paste 行为交给画布全局规则，**不得**静默丢进随机槽。

### 13.4 交互与视觉

- **拖入反馈**：目标区域 `ring-1 ring-white/40`（或项目内统一的 hover ring）；`dragOverKind` 状态与激活槽可并存。
- **空槽占位**：除「空」外可加一行小字 **「拖入 / 粘贴」**（`text-[9px]` muted）。
- **格式**：仅 `file.type.startsWith("image/")`；非图片拖入/粘贴 **忽略**，不弹错（除非产品明确要求 toast）。
- **锁定 / 禁用**：`assetLocked`、`fieldsLocked`、`busy` 时三种入口均不可用，且不注册 paste 拦截。
- **画布节点**：选中节点时可 paste 到该节点（如 `image-node`）；须同样走 capture 拦截，避免与全局 paste 重复建节点。

### 13.5 与画布全局行为的关系

- 根级：`flow-canvas.tsx` 在无激活上传控件时，paste 图片 → 视口中心新建 `image` 节点（保留）。
- 根级：`onDrop` 外部图片 → 同上（保留）。
- **控件级 drop/paste 必须 stopPropagation**，且优先于根级行为。

### 13.6 已落地参考（改代码时对照）

| 场景 | 组件 |
|------|------|
| 角色资产四槽 | `story-pro-character-asset-slots.tsx` |
| 场景资产三槽 | `story-pro-scene-asset-slots.tsx` |
| 风格参考图（多选） | `story-pro-style-node.tsx` |
| 图片节点 | `image-node.tsx` + `MediaHoverBox` |
| 四/六/九宫格参考 | `ref-image-grid-node.tsx` |

### 13.7 新增上传控件自检

- [ ] 点击、拖入、粘贴三种入口均已实现？
- [ ] 使用 `image-upload-handlers.ts`，未复制粘贴/drop 代码？
- [ ] 多槽是否有激活目标 + paste 拦截？
- [ ] textarea 内粘贴文字不受影响？
- [ ] drop/paste 已 `stopPropagation`，不会误触画布建节点？
- [ ] 文案含「点击 / 拖入 / 粘贴」？
- [ ] 是否更新本文 §13 与 `.cursor/rules/canvas-story-design.mdc`？
