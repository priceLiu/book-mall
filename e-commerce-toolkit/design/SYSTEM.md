# 电商工具箱 · 全站基本样式规划（SYSTEM）

> **权威入口**。新页面、新模块、Code Review 均以本文为准；细则分册见文末索引。  
> 品牌：**Apple 风格 · 黑白蓝**（`COLORS.md`），禁止引入第三品牌色。

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **组件优先** | 按钮、弹层、视频、预览须走 `components/ui` / `components/media` / `useDialogs`，禁止散落 hex + 自写主按钮 |
| **层级清晰** | 主操作（蓝胶囊）→ 次要（蓝描边胶囊）→ 工具条（灰圆角）→ 助手快捷（浅灰胶囊）→ 图标浮层 |
| **内容优先** | 工作区浅灰底 `#f5f5f7`，卡片白底；产品/分镜图是主角，chrome 克制 |
| **一致性** | 同色同形：全站描边 `#d2d2d7` / `#e8e8ed`，焦点 `#0071e3`，正文 `#1d1d1f` |
| **可访问** | 禁用 `window.alert/confirm`；破坏性操作二次确认（`useDialogs` + `doubleConfirm`） |

---

## 2. 色彩与 Token

CSS 变量定义：`app/globals.css`。语义表：`COLORS.md`、token 全集：`DESIGN.md`。

| 语义 | Hex / 变量 | 典型用途 |
|------|------------|----------|
| 正文/标题 | `#1d1d1f` `--ecom-ink` | 标题、表内正文、气泡文字 |
| 次要说明 | `#6e6e73` / `#86868b` | 提示、占位、表头副文案 |
| 弱化 | `#7a7a7a` `--ecom-muted` | Dialog 说明、脚注 |
| 页面底 | `#f5f5f7` `--ecom-parchment` | 主内容区、用户气泡底 |
| 助手/浅区 | `#fafafa` | 助手栏、上传区分组底 |
| 卡片白 | `#ffffff` | 卡片、助手气泡、输入框 |
| 描边浅 | `#e8e8ed` | 卡片、区块、分隔 |
| 描边中 | `#d2d2d7` | 输入框、缩略图、工具按钮 |
| 描边深 | `#e0e0e0` `--ecom-hairline` | Dialog、全局 hairline |
| 主色 | `#0066cc` `--ecom-primary` | 主按钮填充 |
| 主色 hover/焦点 | `#0071e3` `--ecom-primary-focus` | 输入 focus、任务条、上传 hover |
| 外壳深 | `#0c0c0e` | App 外层、侧栏背景 |
| 成功 | `#34c759` | 进度轨完成态（少量） |
| 错误/删除 | `#dc2626` | destructive 文案/按钮，不替代品牌蓝 |

---

## 3. 排版

字体栈：`system-ui, -apple-system, sans-serif`（与 `DESIGN.md` SF Pro 对齐）。

| 层级 | class 参考 | 场景 |
|------|------------|------|
| 页面标题 | `text-lg font-semibold text-[#1d1d1f]` | 工作区 H1、助手栏标题 |
| 区块标题 | `text-lg font-semibold` 或 `text-sm font-bold` | StepSection、结果卡片 label |
| 分组小标题 | `text-sm font-semibold text-[#6e6e73]` | 「产品图」「定稿方案」 |
| 正文 | `text-sm leading-relaxed text-[#1d1d1f]` | 气泡、表单、表格单元格 |
| 辅助 | `text-xs text-[#86868b]` | 空状态提示、卡片 emptyHint |
| 微字 | `text-[10px] text-[#86868b]` | 模型名、上传提示 |
| 分区标签 | `text-xs font-medium uppercase tracking-wide text-[#6e6e73]` | 「素材图」等 |

---

## 4. 布局与壳层

详见 `LAYOUT.md`。

- **外壳**：`EcomAppShell` — 深色外框 `#0c0c0e` + 内层圆角工作区 `--ecom-parchment`
- **双栏工作台**：`EcomWorkspaceLayout` — 助手 ~30%（`#fafafa`）+ 可选进度轨 + 内容 ~70%（`#f5f5f7`）
- **区块卡片**：`rounded-xl border border-[#e8e8ed] bg-white p-5`（`StepSection`）
- **滚动**：可滚动区加 `ecom-scrollbar-thin`（`globals.css`）

---

## 5. 按钮体系（五层）

> 主/次胶囊细则：`BUTTON.md`。Dialog 内按钮：`DIALOG.md`（**圆角矩形** `rounded-md`，非胶囊）。

### 5.1 主按钮 · `EcomButtonPrimary`

- **形态**：品牌蓝填充、**全圆角胶囊** `border-radius: 999`
- **动效**：hover `scale 1.05`、tap `0.95`；加载用 `altLabel` + `flipActive`
- **场景**：门户 CTA、助手「发送」、Dialog 确认、步骤级「合并分镜视频」「保存交付快照」
- **尺寸**：单页最多 2 档 `sm | md | lg`（见 `BUTTON.md`）

### 5.2 次要按钮 · `EcomButtonSecondary`

- **形态**：白/透明底 + **品牌蓝描边与文字**、胶囊
- **场景**：门户「了解更多」、助手「清空」、参考图区「上传」、内容区「生成全部分镜图」

### 5.3 工具条按钮 · Toolbar（页面内第三层）

卡片内、表格行内、空状态上的**灰描边圆角矩形**（非胶囊）：

```tsx
// 浅灰底（卡片内主工具操作）
"inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#ebebed] disabled:opacity-50"

// 白底（次要工具操作）
"inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
```

- **场景**：结果卡片空状态「生成分镜图」、表格行「修改」、图标 + 文案并列
- **禁止**：用 `EcomButtonPrimary` 塞满卡片内一排小按钮

### 5.4 助手快捷选择 · Choice Chip（聊天专用）

详见 `CHAT.md`、`.cursor/rules/ecom-storyboard-assistant-choices.mdc`。

```tsx
// 导出：storyboard-assistant-choices.tsx → STORYBOARD_ASSISTANT_CHOICE_CLASS
"rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:border-[#86868b] hover:bg-[#ebebed] disabled:opacity-50"
```

- **仅用于**：助手消息气泡底部的「请选择（无需输入）」选项
- **禁止**：深色填充、按选项类型分样式、气泡外重复渲染

### 5.5 图标按钮

| 类型 | class 参考 | 场景 |
|------|------------|------|
| 顶栏设置 | `h-9 w-9 rounded-lg border border-[#d2d2d7] bg-white … hover:border-[#0071e3] hover:text-[#0071e3]` | 助手设置 |
| 卡片浮层 | `h-8~9 w-8~9 rounded-full bg-black/55 text-white shadow` 或 `bg-white/95 text-[#1d1d1f]` | 重新生成、预览 |
| 缩略删除 | `rounded-full bg-black/65 p-0.5 text-white` + `X` 图标 | 参考图删除 |
| 上传入口 | `Plus` `h-3 w-3` + `EcomButtonSecondary size="sm"` 文案「上传」 | 素材分类 |

图标库：**lucide-react**，尺寸多与文字对齐 `h-3.5~4 w-3.5~4`。

---

## 6. 聊天窗口

详见 `CHAT.md`。

| 区域 | 规范 |
|------|------|
| 助手栏底 | `bg-[#fafafa]`，顶栏 `border-b border-[#e8e8ed]` |
| 用户气泡 | 右对齐 `ml-auto`，`rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7]` |
| 助手气泡 | 左对齐，`rounded-2xl bg-white shadow-sm ring-1 ring-[#e8e8ed]` |
| 正文 | `<pre className="whitespace-pre-wrap font-sans">` 保留换行 |
| 流式/思考 | `StoryboardTaskStatus` 蓝条 + `Loader2` 旋转 |
| 输入框 | `rounded-xl border border-[#d2d2d7] focus:border-[#0071e3]` |
| 发送 | `EcomButtonPrimary size="sm" flex-1`；Enter 发送、Shift+Enter 换行 |
| 快捷按钮 | 仅最后一条助手消息底部一份 Choice Chip |

---

## 7. 表格

详见 `TABLE.md`。

两套模式：

1. **数据表**（分镜脚本等）：深色表头 + 横向滚动
2. **字段行**（定稿方案）：`sm:grid-cols-[7rem_1fr]` 标签-值对

---

## 8. 图片与媒体

详见 `MEDIA.md`、`VIDEO.md`。

| 场景 | 规范 |
|------|------|
| 列表缩略 | `relative overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]` + `Image fill object-cover` |
| 结果预览 | `object-contain`；完整分镜图可 live thumb |
| 点击放大 | `EcomImagePreviewDialog`（灰底 `bg-[#f5f5f7]`、`max-h-[80vh]`） |
| 视频 | `EcomVideoPlayer` / `EcomVideoThumb` + `EcomVideoPreviewDialog` |
| 上传区 | 分类边框块 + `Plus` 上传 + hover 粘贴高亮 `border-[#0071e3] bg-[#0071e3]/5` |
| 产品阴影 | 仅产品摄影可用 `.ecom-product-shadow` |

---

## 9. 表单与输入

| 控件 | class 参考 |
|------|------------|
| 单行 input | `rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30` |
| 多行 textarea | 同上 + `min-h-[88px] resize-y leading-relaxed`（助手输入用 `rounded-xl`） |
| select | `rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-xs` |
| label | `text-sm font-medium text-[#1d1d1f]` |
| 空占位 | 文案 `--` 或 `text-[#86868b]`「待上传」「待生成」 |

Dialog 内表单：与上表一致，底栏 `DialogFooter` 右对齐取消 + 主操作。

---

## 10. 状态与进度

| 组件 | 视觉 |
|------|------|
| `StoryboardTaskStatus` | `border-[#0071e3]/25 bg-[#0071e3]/5`，标题 `text-[#0071e3]`，可折叠 |
| 流式横幅 | `bg-[#0071e3]/10 text-[#0071e3]` + `Loader2` |
| `StoryboardProgressRail` | 竖轨：完成 `#34c759` / 进行中 `#0071e3` / 待办灰 |
| 加载占位 | `Loader2 animate-spin` + `text-[#6e6e73]`「生成中…」 |
| 禁用 | `disabled:opacity-50`，主按钮 `disabled:cursor-not-allowed` |

---

## 11. 空状态与占位

- 缺失数据统一 **`--`**（`text-[#86868b]`），或模块 `emptyHint` 一句说明
- 空卡片最小高度 `min-h-[160px]`，内容居中
- 参考图未上传：`--` 或「待上传」

---

## 12. 禁止清单（全站）

- `window.alert` / `window.confirm` / `window.prompt`
- Tailwind `bg-blue-500` 等硬编码蓝、橙色 Book 订阅色
- 主 CTA 方角按钮（`rounded-md` 仅 Dialog 内允许）
- 裸 `<video controls>`（须 `EcomVideoPlayer`）
- 手写 `fixed` 弹层（须 Radix `Dialog` / `useDialogs`）
- 助手聊天气泡内第二套 Choice 按钮栏
- 单页 `sm`+`md`+`lg` 三档主按钮并存

---

## 13. 组件映射（速查）

| UI 需求 | 组件 / 文档 |
|---------|-------------|
| 主操作 | `EcomButtonPrimary` · `BUTTON.md` |
| 次操作 | `EcomButtonSecondary` · `BUTTON.md` |
| 确认/提示 | `useDialogs()` · `DIALOG.md` |
| 助手聊天 | `StoryboardAssistantPanel` 模式 · `CHAT.md` |
| 助手快捷 | `StoryboardAssistantChoices` / `STORYBOARD_ASSISTANT_CHOICE_CLASS` |
| 工作台布局 | `EcomWorkspaceLayout` · `LAYOUT.md` |
| 数据表 | `TABLE.md` 模式 A |
| 图片预览 | `EcomImagePreviewDialog` · `MEDIA.md` |
| 视频 | `EcomVideoPlayer` · `VIDEO.md` |
| 参考上传 | `StoryboardRefUploader` · `MEDIA.md` |
| 任务状态 | `StoryboardTaskStatus` |
| 导出分镜版式 | `StoryboardProSheetView`（印刷风格，内联样式例外） |

---

## 14. 分册索引

| 文档 | 内容 |
|------|------|
| [COLORS.md](./COLORS.md) | 黑白蓝语义色 |
| [DESIGN.md](./DESIGN.md) | Apple token 全集 |
| [BUTTON.md](./BUTTON.md) | 胶囊主/次按钮 |
| [DIALOG.md](./DIALOG.md) | 弹出层 |
| [VIDEO.md](./VIDEO.md) | 视频播放 |
| [LAYOUT.md](./LAYOUT.md) | 壳层与双栏 |
| [CHAT.md](./CHAT.md) | 创作助手聊天 |
| [TABLE.md](./TABLE.md) | 表格与字段行 |
| [MEDIA.md](./MEDIA.md) | 图片上传与预览 |

---

## 15. 演进（待抽取组件）

以下模式已在业务中重复使用，后续可抽为 `components/ui/ecom-*`：

- `EcomToolbarButton` — §5.3 工具条按钮
- `EcomChoiceChip` — §5.4（与助手 choices 合并）
- `EcomDataTable` — §7 模式 A
- `EcomStepSection` — 右侧步骤区块外壳

在新代码中 **先复制 class 字符串**，抽取组件时以本文档为准迁移。
