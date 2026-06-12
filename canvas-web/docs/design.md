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
| `NODE_DEFAULT_SIZE["jianying-export"]` | **400 × 780** | 同上（含云端自动剪辑区，无内滚） |
| `NODE_DEFAULT_SIZE["jianying-export-pro"]` | **400 × 780** | 同上 |
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

- 生成 / 重生成：`size-9`，橙描边 `border-[#fb923c]/40`（专业版见 `storyEditionIconBtnClass`）
- 预览：`size-9`，白描边 `border-white/20`
- 分镜视频快捷：`size-8` 右下角 `Clapperboard`
- **生成中动效**（扫光 / 旋转圈 / 图标分工）：见 **§15**

### 3.5 放大镜预览

- 组件：`StoryPreviewMagnifyButton`
- 标题栏：`onDark` — 橙底描边 28×28
- 白纸预览 hover：`onLight` — 白底橙字
- 预览纸 hover  overlay：居中 44×44 圆 + Search 图标

### 3.6 标准版画布 · 顶部工具区

**适用范围**：普通画布（海报 / 故事 / 参考生视频三组节点面板并存时）。**真源**：`components/canvas/toolbar.tsx` · `components/canvas/node-palette.tsx` · `app/canvas/[id]/canvas-page-client.tsx`。

影视专业版节点面板配色见 **§14**；布局与「不占整行、无大块黑底」规则与本节相同。

#### 3.6.1 两层结构（禁止合并为一行黑条）

```text
┌─ sticky 顶栏（仅项目操作）──────────────────────────────┐
│ CanvasToolbar：返回 · 项目名 · 保存/撤销/运行 · 库入口…  │
│ GatewayLinkBanner（若有）                               │
└────────────────────────────────────────────────────────┘
┌─ 画布区域（FlowCanvas）────────────────────────────────┐
│   ┌ 浮层节点面板（NodePalette）────────────────┐      │
│   │  居中 · w-fit · 不铺满视口宽度              │      │
│   └────────────────────────────────────────────┘      │
│   …节点…                                              │
└──────────────────────────────────────────────────────┘
```

- **项目顶栏**（`CanvasToolbar`）：`header` 全宽、`bg-[var(--canvas-surface)]`、`border-b border-white/10` — 仅此一行承担「顶栏」职责。
- **节点面板**（`NodePalette`）：**不得**再占 `sticky` 顶栏下的第二行；须挂在画布容器内 `absolute inset-x-0 top-2 z-[60]`，外层 `pointer-events-none`，内层 `pointer-events-auto`。
- **禁止**：节点面板外包一层全宽 `bg-black/*` 或 `bg-[var(--canvas-surface)]` 条带；禁止 `justify-center` 的块级父级撑满整行造成「空黑边」。

#### 3.6.2 节点面板 · 分组 pill（标准版）

| 项 | 规范 |
|----|------|
| 宽度 | `inline-flex` + `w-fit`；组间距 `gap-1.5`；**仅包住图标与节点按钮** |
| 容器 | `rounded-full border border-white/12 bg-[var(--canvas-surface)]/75 px-1 py-0.5 shadow-md backdrop-blur-sm` |
| 分组标签 | **禁止**橙字「海报创作 / 故事创作 / 参考生视频」；用 **分组徽标**（`PaletteGroupBadge`） |
| 徽标尺寸 | 展开 `size-9`；收到右侧竖排时 `size-8` |
| 徽标样式 | `border-white/15 bg-white/[0.06]` + 图标色 `text-[#fb923c]`（`PALETTE_BADGE_CLASS`） |
| 徽标图标 | 海报 `Palette` · 故事 `Clapperboard` · 参考生视频 `Video`（常量 `PALETTE_GROUPS`） |
| 悬停说明 | 徽标 `title` + tooltip 显示中文分组名（无障碍 `aria-label` 同文案） |
| 节点按钮 | `size-9` 圆钮；`hover:bg-[var(--canvas-accent)]/20`；tooltip 在钮下方 |
| 组内分隔 | 竖线 `\|`：`PaletteDivider`（非竖排时） |
| 尾部操作 | 帮助 `HelpCircle`、收到右侧 `ChevronRight` 接在**最后一组 pill 右侧**（勿只挂在第一组） |

**标准版三组内容**（`node-palette.tsx`）：

| 徽标 | 数组常量 | 典型节点 |
|------|----------|----------|
| 海报 | `CANVAS_PALETTE` | 图片、文本、AI/生图引擎、输出、剪映 |
| 故事 | `STORY_PALETTE` | 故事主题、大纲、角色列、分镜列、视频列… |
| 参考生视频 | `REF_VIDEO_PALETTE` | 四/六/九宫格、AI 视频引擎、视频生成 |

#### 3.6.3 节点面板 · 收到右侧（可选）

- `fixed right-2 top-1/2` 竖向组合：`bg-[var(--canvas-surface)]/90` + `backdrop-blur-md`（**禁止** `bg-black/75` 大块纯黑）
- **结构（硬性）**：**「移到顶部」钮在节点列表卡片左侧**，与整列工具条 **垂直居中**（`flex-row items-center`），不参与列表布局；翡翠描边 `size-10`；底部固定帮助钮
- **尺寸**（右侧 dock）：节点钮 **22px**（`size-[22px]`）、图标 **12px**（`size-3`）；分组徽标同 **22px**；帮助钮同节点钮；「移到顶部」仍 `size-10`
- **禁止** 右侧列表区 `overflow-y-auto` / 内嵌滚动条；列表随内容自然撑高（整列居中 `top-1/2`）
- 展开回顶部：仅右侧组合顶部的收起钮；**禁止**顶栏再出现全宽「节点面板在右侧」提示条

#### 3.6.4 项目顶栏按钮（CanvasToolbar）

| 类型 | 样式 |
|------|------|
| 默认次要 | `border-white/10` · `text-[var(--canvas-muted)]` · 11px |
| 强调（我保存的剧本 / 项目资产） | `border-emerald-400/25 bg-emerald-500/8 text-emerald-100/90` |
| 运行 | 实心强调（见 `toolbar.tsx` 运行钮） |
| 项目名 | `text-emerald-200` · 透明底 · focus 时浅底 |

#### 3.6.5 硬性禁止（Code Review）

- 节点面板占 **整行** 或铺满视口宽的黑/灰底条
- 分组用 **文字标签** 代替徽标（专业版可用青色系徽标 + `Sparkles`，见 §14）
- pill 使用 `bg-black/70`、`bg-black/75` 作为主背景
- 将 `NodePalette` 与 `CanvasToolbar` 放在同一 `sticky` 块内且让面板独占一行

新增/改版顶部 UI 时须对照本节；常量与类名优先收口到 `node-palette.tsx`，避免在页面层重复写布局。

### 3.7 画布视口 · 鼠标滚轮

**适用范围**：`FlowCanvas`（`flow-canvas.tsx`）、模板只读预览（`template-readonly-canvas.tsx`）、画布项目页（`canvas-page-client.tsx` 文档级拦截）。

| 操作 | 行为 |
|------|------|
| 滚轮（画布内任意位置，**除**下方表单控件） | **平移**视口（`panOnScroll` + `PanOnScrollMode.Free`；横向可用 Shift+滚轮） |
| **Ctrl + 滚轮** | **缩放**（`zoomOnScroll={false}` + `zoomActivationKeyCode="Control"`） |
| Space + 拖 / 中键·右键拖 | 平移（与改前一致） |
| 拖空白 | 框选（`selectionOnDrag`） |

**文本框 / 原生 `<select>`**：

- 类名：`RF_FORM_CONTROL`（仅 `nodrag`，**禁止** `nowheel`），真源 `lib/canvas/react-flow-classes.ts`。
- 滚轮 **不** 滚动框内内容，**与节点其它区域相同** 用于 **平移画布**；浏览超长文案仅 **拖动滚动条**（`overflow-y-auto` + `max-h-*` / 分隔布局）。
- 实现：`canvas-form-wheel.ts` 在控件上 `preventDefault`（不 `stopPropagation`）；`CanvasPromptTextarea` 默认 `RF_FORM_CONTROL` + `onWheel`。

节点内 **预览区 / 画廊 / 按钮 / 节点外壳滚动区**（`RF_NODE_SCROLL` = 仅 `nodrag`）与空白处相同：**滚轮平移画布**（不再使用 `nowheel` 阻断）。

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

### 4.5 确认 / 提示 / 输入（禁止原生弹窗）

组件：`DialogProvider` + `useDialogs()`（`components/dialogs/dialog-provider.tsx`）

| API | 用途 |
|-----|------|
| `confirm` | 单次确认（锁定、套用模板、继续定稿等） |
| `doubleConfirm` | 二次确认（删除库条目、移除 OSS 资源等） |
| `alert` | 只读提示（错误 / 成功 / 警告，`variant`） |
| `prompt` | 单行输入（如驳回原因）；取消返回 `null` |

**硬性约束**

- **禁止** `window.alert` / `window.confirm` / `window.prompt`
- z-index **1000**；暗紫卡片 + 遮罩 `bg-black/60 backdrop-blur-sm`
- `Esc` 与点遮罩 = 取消；`Enter` = 确认；`danger: true` 时确认钮红色
- 同时仅一个对话框；队列顺序弹出

Cursor 规则：`.cursor/rules/no-native-dialogs.mdc`

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

- 提示词：`MentionsTextarea`，支持 `@<ref-char-*>`、`@<ref-asset-*>` 等上游参考（见 §7.1.1）
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

- 宽 **220**，与分镜图条同高 **248**（`STORY_FRAME_ROW_STRIP_H`）
- 布局：**单槽 fill**（`object-cover` 铺满列高）；多图时 **左右 `<` `>`** 切换（`StoryUpstreamImageColumn`），角标 `当前/总数`
- 被 `@` 引用的图：快手 **橙框** / 专业版 **青框** — `storyEditionActiveRefBorderClass(edition)`
- 未引用：`border-white/15`
- 有图：悬停居中 **Eye**；**点击** → `StoryMediaPreviewModal`（生成中隐藏 Eye，见 §15.3）
- **生成中**：仅 **整列外框** 扫光（§15.3），**禁止**单格旋转圈
- 无图占位：格内「待上游」/ 空列 `—`
- 分镜图过审：仅 **「通过」**（无驳回）；未过审不可生视频（`story-frame-gate.ts`）

### 7.1.1 分镜视频 · 多 `@` 参考与 Gateway 入参

- 分镜/视频行 `refImages` 须 **完整同步** 分镜行上的 `ref-char-*`、`ref-asset-*`、`ref-scene-asset-*`（`story-column-sync` · `patchVideoRowsForRun`）；禁止仅保留 `ref-char-*`。
- 服务端 `resolveStoryRowRefUrls` 按 `videoPrompt` 内 `@<id>` 从 `refImages[].url` 解析；`imageInputs = [分镜主图, …参考图]`，展开后 prompt 末尾带 `[参考图片]` 图1…图N。
- **Kling 2.6 i2v**（及同类单槽 i2v）：Gateway `image_urls` **仅 1 张**（分镜静帧）；其余 `@` 参考只进 **prompt 文本**（`[参考图片]` 图2+），非 API 多图槽。多图 i2v 选 **Seedance 2** 等（`reference_image_urls`）。

### 7.2 输出图列

- 宽 **248**；`object-contain` 黑底槽
- hover 显示生成/重生成/预览；分镜有图时右下角 **Clapperboard** 生视频
- **生成中**：扫光 + 中央 **RefreshCw** 旋转（§15.3）

### 7.3 历史对比弹层（引擎节点）

组件：`CompareModal` / `CompareSplitView` / `MediaHoverBox`

- 全屏 `z-[1100]`，`bg-black/94`
- 顶栏 `CompareToolbar`：左图/右图下拉 + 步进
- 视图：**重叠 + 竖向滑块** 切分对比（非简单并排）
- 默认：主图 vs 参考图，或主图 vs 上一张任务
- 键盘：`←` / `→` 切右图，`Escape` 关闭
- 预览弹层内 Tab：**大图 | 对比**（需传入 `compareContext`）

---

## 8. 文案色阶（提示 / 状态 / 错误）

真源：`lib/canvas/story-column-sync.ts` · 组件：`components/canvas/story-status-line.tsx`

| 语义 | 常量 / 组件 | 样式 | 用途 |
|------|-------------|------|------|
| **提示**（图 2 金黄） | `STORY_HINT_GOLD_CLASS` | `text-amber-300/90` | 前置条件、@ 说明、锁定占位、视频未就绪说明 |
| 提示区块标签 | `STORY_HINT_LABEL_CLASS` | 左竖线 `border-amber-400/55` + 10px uppercase 金字 |
| 提示正文 | `STORY_HINT_BODY_CLASS` | 10px `leading-relaxed` 金字 |
| **节点 chrome**（绿色） | `STORY_CHROME_GREEN_CLASS` | `text-emerald-300/90` | 顶部导航、工具栏项目名、节点标题/副标题、行标题徽章、状态文案 |
| 节点区块标题 | `STORY_ROW_SECTION_CLASS` | 10px 绿色 | 资产四槽区标题、「资产就绪」类状态 |
| 槽位次级标签 | `STORY_ROW_SUBLABEL_CLASS` | 9px `text-emerald-200/75` | 脸 / 全身 / 服装等槽名 |
| 影视专业版字段标签 | `PRO_HINT_LABEL_CLASS` | 10px uppercase `text-emerald-300/85` | 风格节点「风格库 / 锚定词」等（详见 §14） |
| **错误**（图 3 红） | `STORY_ERROR_LINE_CLASS` / `StoryErrorLine` | `truncate text-red-400/90` | 单行省略；**必须** `title={全文}` 悬停展示 |

固定文案与用法：

- **故事主题** 底栏：`LLM 模型（文案共用）` → `STORY_HINT_LABEL_CLASS`（金黄）
- **分镜列** 模型区：`分镜图 · IMAGE`、`分镜视频 · VIDEO` → `STORY_HINT_LABEL_CLASS`
- **镜 1 @ 提示**：`FRAME_ROW_AT_HINT` → `STORY_HINT_BODY_CLASS`，显示在提示词输入框下方
- **视频锁定占位**（静帧先行）：锁图标 + 文案 → `STORY_HINT_GOLD_CLASS`（与图 2 一致）
- **生成失败 / API 错误**：统一 `StoryErrorLine`，禁止多行撑高节点行

### 8.1 禁止混用

- 提示语 **不得** 用 `var(--canvas-muted)` 或蓝色 `#60a5fa`（已废弃）
- 节点标题 / 菜单 / 状态 **不得** 用金黄或 muted 代替绿色
- 错误 **不得** 用 amber 或 muted；非错误状态 **不得** 用红色
- 橙色 `#fb923c` **仅**用于快手漫剧主按钮、Tab、**@ 激活参考图**；影视专业版用青色（§14）

### 8.2 新增 UI 自检

- [ ] 说明类文案是否走 `STORY_HINT_*`（金黄）？
- [ ] 标题 / 导航 / 状态是否走 `STORY_CHROME_*` / `PRO_HINT_*`（绿）？
- [ ] 错误是否走 `StoryErrorLine` 且悬停可见全文？
- [ ] 是否同步 `.cursor/rules/canvas-story-design.mdc`？

---

## 9. 色彩与强调

| 用途 | 色值 |
|------|------|
| 漫剧强调橙 | `#fb923c` / `#fdba74` / `#ea580c` |
| 提示金黄 | `text-amber-300/90`（见 §8） |
| 节点 chrome 绿 | `text-emerald-300/90` / `text-emerald-200/75` |
| 错误红 | `text-red-400/90` |
| 画布 muted 文案 | `var(--canvas-muted)`（**非**提示/状态/错误） |
| 画布表面 | `var(--canvas-surface)` |

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
| 列内生成中动效 / 预览图标 | §15 · `story-edition-chrome.ts` · `globals.css` |
| 标准版 · 顶部工具区 / 节点面板 | §3.6 · `toolbar.tsx` · `node-palette.tsx` · `canvas-page-client.tsx` |

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

---

## 14. 影视专业版（Story Pro）视觉规范

与 **快手漫剧版**（橙色 `#fb923c`）并列的第二套工作流。节点类型前缀 `story-pro-*`；共用列组件通过 `edition: "pro"` 分流配色。

**真源常量**：`lib/canvas/story-pro-node-chrome.ts` · **列/媒体分流**：`lib/canvas/story-edition-chrome.ts`（`storyEditionFromNodeType` → `story-pro-*` 为 pro）

### 14.1 色彩分工（勿混用）

| 语义 | 色 | 常量 / 函数 | 用途 |
|------|-----|-------------|------|
| **专业版主强调** | 青 `#22d3ee` / `cyan-400` | `PRO_NODE_ACCENT` · `storyEditionAccent("pro")` | 节点边框、底栏主钮、弹层 Tab/保存、批量生成、@ 激活参考图、生成中描边 |
| **节点 chrome / 字段标签** | 翡翠 `emerald-300` | `PRO_HINT_LABEL_CLASS` · `STORY_ROW_SECTION_CLASS` | 表单标签、资产区标题、就绪状态（与 §8 绿色一致） |
| **提示 / 前置条件** | 金黄 `amber-300` | `STORY_HINT_*`（§8，两版共用） | @ 说明、锁定占位、模型区标签 |
| **错误** | 红 `red-400` | `StoryErrorLine`（§8，两版共用） | API / 校验失败 |
| **入库 / 保存到资产库** | 青图标 + 翡翠 CTA | `StoryProAssetImportIcon` · `PRO_SAVE_TO_ASSETS_BTN_CLASS` | 槽位「入库」用 Layers 图标；「保存到项目资产」用翡翠描边钮 |

**禁止**：专业版节点/弹层主操作使用橙色 `#fb923c`（仅快手版）；提示语勿用 `var(--canvas-muted)` 代替金黄（§8.1）。

### 14.2 节点面板（顶栏浮层）

- 布局与 §3.6 相同（画布内浮层、`w-fit`、禁止整行黑条）
- 仅 **一组** pill：`PALETTE_GROUPS.pro` · 徽标 `Sparkles` · 文案「影视专业版」
- pill 容器：`border-cyan-400/25 bg-[var(--canvas-surface)]/80`（`proTheme`）；徽标色 `PRO_PALETTE_BADGE_CLASS`（`text-cyan-300`）
- 节点钮 hover：`hover:bg-cyan-500/20`

### 14.3 节点壳与底栏

| 项 | 规范 |
|----|------|
| 外壳 | `ProNodeShell` · 渐变深底 · 边框 `PRO_NODE_ACCENT` / `PRO_NODE_BORDER` |
| 底栏 | `PRO_NODE_SHELL_FOOTER_CLASS` · 顶部分割 `border-cyan-400/15` |
| 主操作钮 | `PRO_NODE_ACTION_BTN_CLASS` / `_SPLIT_` · h-9 · 青描边实心 |
| 列批量 | `storyEditionBatchBtnClass("pro")` → `STORY_PRO_BATCH_BTN_CLASS` |
| 五阶段 | `StoryProStageRail` · 当前=青 · 已完成=翡翠 · 未开始=白/灰 |
| 指引 | `StoryProGuidePanel` · `PRO_GUIDE_*` |

控制节点尺寸：`STORY_PRO_CONTROL_NODE_WIDTH` × `STORY_PRO_CONTROL_NODE_HEIGHT`（1020×1200，与漫剧控制行对齐）。

### 14.4 行内资产槽（人物四槽 / 场景三槽）

| 项 | 常量 |
|----|------|
| 面板容器 | `PRO_ASSET_PANEL_CLASS` |
| 槽位名 | `STORY_ROW_SUBLABEL_CLASS` |
| 区标题 | `STORY_ROW_SECTION_CLASS` |
| 提示条 | `STORY_ROW_BANNER_CLASS` + `StoryHintLine` |
| 工具栏上传/锁/删 | `PRO_SLOT_TOOLBAR_BTN_CLASS` |
| **入库** | `PRO_SLOT_IMPORT_BTN_CLASS` + `StoryProAssetImportIcon`（禁止「入库」二字） |
| 次要行操作 | `PRO_ROW_SECONDARY_BTN_CLASS` |
| 快捷保存三视图 | `PRO_ROW_PRIMARY_BTN_CLASS` |

上传：§13 三入口；空槽文案含「拖入 / 粘贴」。

### 14.5 媒体列（与快手共用组件）

`story-column-media-panel` · `story-video-row-slot` · `story-row-prompt-field` 传入 `edition="pro"` 时：

| 行为 | 函数 |
|------|------|
| @ 激活参考图边框 | `storyEditionActiveRefBorderClass("pro")` |
| 生成中扫光 | `storyEditionGeneratingBorderClass("pro")` · 左列整框 / 右列输出槽（§15） |
| 生成中旋转圈 | `storyEditionSpinClass("pro")` · **仅右列输出**，左 @ 列禁止 |
| 圆形生成/预览钮 | `storyEditionIconBtnClass` / `OverlayIconBtnClass` |
| 分镜右下角生视频 | `storyEditionVideoOverlayBtnClass` · `Clapperboard` |
| 视频列重新生成 | `storyEditionCornerRegenBtnClass` |
| 宫格悬停预览 | **Eye**（§15.2） |
| 模型区标签 | `PRO_HINT_LABEL_CLASS`（pro）/ `STORY_HINT_LABEL_CLASS`（comic） |

### 14.6 弹层

| 弹层 | 顶栏 / Tab |
|------|------------|
| 故事剧本审阅 | `StoryScriptHubModal` · **`edition="pro"`**（由 `story-pro-script-hub-node` 传入） |
| 导演提示词 | `StoryThemePromptModal` · **`proDirectorPack`** → 青 Tab/保存 |
| 定稿剧本历史 | `StoryProFinalizedScriptModal` · `PRO_MODAL_HEADER_CLASS` |
| 上传剧本预览 | `StoryProScriptUploadPreviewModal` · 同上 |
| 审阅双栏正文 | 与 §4.2 相同（白卡片 + `MarkdownView document`） |

Tab / 保存 / 生成：`storyEditionModalTabClass` · `storyEditionModalSaveBtnClass` · `storyEditionModalOutlineBtnClass`。

### 14.7 项目资产侧栏 / `/assets`

| 项 | 常量 |
|----|------|
| 侧栏边框 | `border-cyan-400/15`（`PRO_ASSETS_SIDEBAR_BORDER_CLASS`） |
| 列表卡片 | `PRO_ASSETS_CARD_CLASS` |
| Tab 选中 | `PRO_ASSETS_TAB_ACTIVE_CLASS`（青，非翡翠） |
| 标题图标 | `StoryProAssetImportIcon` · `ProjectAssetsPanelIcon` |

**Tab 划分**：角色视觉 / 角色音频 / 场景·道具 / **全局风格**（用户 `StoryProStyleProfile` 入库）/ **风格库**（平台内置只读目录，仅 `/assets` 宽 Tab，侧栏不含）。

### 14.7.1 平台风格库

| 项 | 说明 |
|----|------|
| 数据真源 | `lib/canvas/style-library/catalog.ts`（由 `docs/style.html` 生成，135 条） |
| 预览图 | OSS `canvas/style-library/{id}.webp`；上传 `book-mall`：`pnpm canvas:upload-style-library` |
| 本地图源 | `canvas-web/assets/style-library-source/{id}.webp` |
| UI | `StyleLibraryGrid`：分类 pill + 网格；预览区 **`aspect-[400/550]`** + `object-contain`（与源图 400×550 一致）；hover 底部 overlay 显示 `prompt` |
| 画布入口 | 工具栏「风格库」→ `StyleLibraryModal`（`max-w-6xl`）；风格节点「浏览风格库…」 |
| 套用 | `useApplyStyleLibraryPreset` → 写入 `story-pro-style`：`styleAnchorZh` + 可选 `refImages`（分类→内部元数据，无下拉 UI） |
| 禁止 | 外网预览 URL；不自动写入全局风格 Profile |

### 14.8 组件核查清单（改 UI 时对照）

| 组件 | 状态 | 要点 |
|------|------|------|
| `pro-node-shell.tsx` | ✅ | `PRO_NODE_ACCENT` 边框 |
| `story-pro-starter-node.tsx` | ✅ | `PRO_*` 表单/底栏/模板 chip |
| `story-pro-script-hub-node.tsx` | ✅ | 审阅弹层 `edition="pro"` |
| `story-pro-style-node.tsx` | ✅ | `PRO_UPLOAD_DROPZONE` · `PRO_SAVE_TO_ASSETS` |
| `story-pro-stage-rail.tsx` | ✅ | `PRO_STAGE_*` |
| `story-pro-guide-panel.tsx` | ✅ | `PRO_GUIDE_*` |
| `story-pro-character-asset-slots.tsx` | ✅ | 面板/工具栏/入库图标 |
| `story-pro-scene-asset-slots.tsx` | ✅ | 同上 |
| `story-pro-character-audio-slot.tsx` | ✅ | `STORY_ROW_SECTION` 绿标题 |
| `story-pro-frame-row-extras.tsx` | ✅ | `PRO_ROW_SECONDARY` |
| `story-character-column-node.tsx` | ✅ | `edition` 分流 + `PRO_ROW_PRIMARY` |
| `story-frame-column-node.tsx` | ✅ | `edition="pro"` 媒体/标签 |
| `story-video-column-node.tsx` | ✅ | 同上 |
| `story-pro-scene-column-node.tsx` | ✅ | pro 列 |
| `story-script-hub-modal.tsx` | ✅ | `edition` prop |
| `story-theme-prompt-modal.tsx` | ✅ | `proDirectorPack` → 青 |
| `story-pro-finalized-script-modal.tsx` | ✅ | `PRO_MODAL_HEADER` |
| `story-pro-script-upload-preview-modal.tsx` | ✅ | 同上 |
| `project-assets-view.tsx` | ✅ | Tab/卡片/链接常量 · 风格库 Tab |
| `style-library-grid.tsx` | ✅ | 分类 pill · hover prompt |
| `style-library-modal.tsx` | ✅ | 画布大弹层 · 套用风格定义 |
| `my-project-character-assets-panel.tsx` | ✅ | 侧栏青边 + 资产图标 |
| `story-column-media-panel.tsx` | ✅ | `storyEdition*` 分流 |
| `story-column-batch-footer.tsx` | ✅ | `storyEditionBatchBtnClass` |
| `jianying-export-pro-node.tsx` | — | 沿用 pro 节点壳 |

### 14.9 新增专业版 UI 自检

- [ ] 是否从 `story-pro-node-chrome.ts` / `story-edition-chrome.ts` 取类名，而非手写 `border-cyan-*`？
- [ ] 共用弹层是否传入 `edition="pro"` 或 `proDirectorPack`？
- [ ] 提示/错误是否仍走 §8 金黄/红，标题是否走绿 `PRO_HINT` / `STORY_ROW_SECTION`？
- [ ] 入库是否用 `StoryProAssetImportIcon`，而非「入库」文案？
- [ ] 是否更新本文 §14 与 `.cursor/rules/canvas-story-design.mdc`？

---

## 15. 列内媒体 · 生成中动效与预览图标

漫剧列（角色 / 分镜 / 视频）与影视专业版共用组件，经 `edition: "comic" | "pro"` 分流颜色。**禁止**自写第二套 shimmer 或换用其他 loading 图标。

### 15.1 扫光动效（CSS 真源）

| 项 | 位置 | 说明 |
|----|------|------|
| 动画名 | `canvas-web/app/globals.css` | `@keyframes canvas-story-media-shimmer` · 1.4s · `translateX(-100%→100%)` |
| 基础类 | `.canvas-story-media-generating` | 外框光晕（橙）+ `::after` 斜向渐变扫光 |
| 专业版叠加 | `.canvas-story-media-generating-pro` | 扫光色改为青 `rgba(34,211,238,0.22)` |
| React 挂载 | `storyEditionGeneratingBorderClass(edition)` | 同时含 `relative`/`overflow-hidden` 容器 + 上述 class + `border-*` |

挂载容器须 **`position: relative`** 且 **`overflow: hidden`**（或 `overflow-y-auto` 的满高外框），使 `::after` 覆盖**可见区域整块**，而非单个缩略图。

### 15.2 图标分工（lucide-react）

| 图标 | 场景 | 组件 | 禁止 |
|------|------|------|------|
| **Eye** | 悬停预览 overlay（**仅** `size-9` 圆形钮，无药丸底、无「预览」文案） | 分镜 @ 宫格、资产槽、输出图、`MediaHoverBox` | 勿用 Search 替代宫格悬停；禁止黑框+文字 |
| **RefreshCw** | 生成中 **旋转**（`animate-spin`） | 输出图/视频槽中央 overlay | **禁止**用于左侧 @ 参考图列 |
| **RefreshCw**（静态） | 重新生成钮（非 spin） | `storyEditionOverlayIconBtnClass` | — |
| **Clapperboard** | 分镜图右下角「生视频」 | `storyEditionVideoOverlayBtnClass` | — |
| **Search** | 故事主题/大纲 **节点头** 打开审阅 | `StoryPreviewMagnifyButton` | 勿用于列内宫格 |
| **Layers** | 入库到项目资产 | `StoryProAssetImportIcon` | 禁止「入库」二字 |
| **Upload** | 槽位上传 | 资产四槽/三槽工具栏 | — |
| **Check** | 分镜图「通过」 | `story-column-media-panel` 左下角 | 已移除「驳回」 |

旋转圈颜色：`storyEditionSpinClass(edition)` — 快手 `#fdba74` · 专业版 `text-cyan-300`（`size-6` / `size-8`）。

### 15.3 分镜行 · 左参考图列 vs 右输出列（硬性）

组件：`story-row-prompt-field.tsx` · `StoryUpstreamImageColumn` · `StoryColumnMediaPanel`

| 列 | 宽×高 | 生成中状态 | 动效 |
|----|-------|------------|------|
| **左 · @ 参考图** | 220×248 | `upstreamGenerating={frameRunning}` | **仅**外框 `storyEditionGeneratingBorderClass` 扫光；**无** `RefreshCw` |
| **右 · 分镜图** | 248×248 | `generating={frameRunning \|\| videoRunning}` | 扫光 + 中央 **`RefreshCw` 旋转** |

左列实现要点：

1. `storyEditionGeneratingBorderClass` 加在 **满高** 外框（`h-full w-full overflow-hidden`）。
2. 单图 **`object-cover` fill**；多图时 **左右 Chevron** + 角标 `n/total`（`StoryUpstreamImageColumn`）。
3. 生成中：`pointer-events` 禁用预览与切换；不渲染 Eye overlay。

右列实现要点：`StoryColumnMediaPanel` 内层 `absolute inset-0` + generating class；overlay 内 `RefreshCw` + `storyEditionSpinClass`。

仅 **分镜图**生成（`frameRunning`）时左列扫光；**仅视频**生成（`videoRunning`）时不扫左列。

### 15.4 其他列（同一套分流）

| 列 / 槽 | 组件 | 生成中 |
|---------|------|--------|
| 角色三视图输出 | `StoryColumnMediaPanel` | 扫光 + 中央旋转圈 |
| 分镜视频 | `story-video-row-slot.tsx` | 扫光 + 旋转圈（`size-8`） |
| TTS 配音 | `story-tts-row-slot.tsx` | 扫光 + 旋转圈 |
| 资产槽预览 | `story-pro-*-asset-slots` | 悬停 **Eye**；无列级扫光 |

节点外壳生成：`ProNodeShell` / `NodeShell` · `canvas-node-generating` 边框呼吸（`canvas-node-generating-pulse`），与列内媒体扫光**叠加**、不替代。

### 15.5 禁止事项

1. **禁止**在 @ 参考图槽上加 `RefreshCw` / 旋转圈。
2. **禁止**恢复 3 列小图宫格（多图须用左右切换，单槽 fill）。
3. **禁止**参考图列 `overflow-y` 纵向滚一堆缩略图。
4. **禁止**列内预览悬停改用 Search；节点头审阅放大镜仍用 `StoryPreviewMagnifyButton`（Search）。
5. 专业版生成中 **禁止**橙色扫光（须 `canvas-story-media-generating-pro`）。

### 15.6 新增/改动媒体 UI 自检

- [ ] 扫光是否只 via `storyEditionGeneratingBorderClass` + `globals.css`？
- [ ] 左 @ 列是否仅整列外框扫光、无旋转圈？
- [ ] 右输出列是否在扫光上叠加 `RefreshCw` spin？
- [ ] 多图参考是否仅左右切换 + fill，无小图宫格？
- [ ] 悬停预览是否 **Eye**（非 Search）？
- [ ] 是否更新本文 §15 与 `.cursor/rules/canvas-story-design.mdc`？
