# QuickReplica · MiniMax Design System

> 来源：[awesome-design-md / minimax](https://github.com/asadravian/awesome-design-md-google-stitch/tree/main/design-md/minimax)（社区逆向，非官方）。  
> QuickReplica 使用 **Dark 变体**（见 §10）；Light 原文见同目录 upstream `DESIGN.md` 备份。

## 1. 视觉气质

MiniMax：白底产品展示 + 彩色卡片。QuickReplica 为创作工具，采用 **preview-dark** 色板：深灰底、蓝品牌、圆角卡片、紫调阴影。

- UI 字体：**DM Sans**（正文/按钮/导航）
- 展示字体：**Outfit**（区块标题，可选）
-  pill 导航 `9999px`；CTA / 输入 `8px`；卡片 `20px`
- 主色 `#3b82f6`；装饰粉 `#ea5ec1` **仅** badge/图钉，勿用于正文按钮

## 2. Dark Tokens（QuickReplica 真源）

| Token | 值 | 用途 |
|-------|-----|------|
| `--qr-bg-page` | `#181e25` | 页面底 |
| `--qr-bg-surface` | `#1f2731` | 侧栏/面板 |
| `--qr-bg-elevated` | `#252d38` | 卡片/弹层 |
| `--qr-bg-input` | `#1f2731` | 表单 |
| `--qr-text-primary` | `#f0f2f5` | 主文案 |
| `--qr-text-secondary` | `#a0a8b4` | 次要 |
| `--qr-text-muted` | `#6b7280` | 占位/计数 |
| `--qr-border` | `rgba(255,255,255,0.08)` | 分割线/边框 |
| `--qr-brand` | `#3b82f6` | 主按钮/选中 |
| `--qr-brand-hover` | `#2563eb` | hover |
| `--qr-brand-deep` | `#1456f0` | 强调 |
| `--qr-accent-pink` | `#ea5ec1` | 置顶 pin / new badge |
| `--qr-shadow-card` | `0 4px 6px rgba(0,0,0,0.25)` | 卡片 |
| `--qr-shadow-brand` | `0 0 15px rgba(44,30,116,0.30)` | 选中/featured |
| `--qr-radius-btn` | `8px` | 按钮/输入 |
| `--qr-radius-card` | `20px` | 模板/kind 卡 |
| `--qr-radius-pill` | `9999px` | 导航 pill |

## 3.  typography

| 角色 | 字体 | 大小 | 字重 |
|------|------|------|------|
| 顶栏标题 | DM Sans | 14–16px | 600 |
| 面板标题 | DM Sans | 14px | 500 |
| 卡片标题 | DM Sans | 14px | 500 |
| 正文/表单 | DM Sans | 14–16px | 400–500 |
| 标签/计数 | DM Sans | 12–13px | 500 |
| 区块标题（可选） | Outfit | 18–24px | 600 |

行高默认 **1.5**。

## 4. 组件

### 主按钮 `.qr-btn-primary`
- bg `--qr-brand`，hover `--qr-brand-hover`
- 文字白，padding 11px 20px，radius 8px
- 产生/复制/完成

### 次按钮 `.qr-btn-secondary`
- bg `rgba(255,255,255,0.08)`，border `--qr-border`
- radius 8px 或 pill（导航）

### 导航 pill 选中 `.qr-nav-active`
- bg `rgba(255,255,255,0.08)`，文字 primary
- radius 9999px

### 分类格 `.qr-nav-category-active`
- border `rgba(59,130,246,0.35)`，bg `rgba(59,130,246,0.12)`，shadow brand

### 卡片 `.qr-card` / `.qr-card-selected`
- bg `--qr-bg-elevated`，border `--qr-border`，radius 20px
- selected: ring 2px brand + `--qr-shadow-brand`

### 输入 `.qr-input`
- bg `--qr-bg-input`，border `--qr-border`，radius 8px
- focus: border brand + `0 0 0 3px rgba(59,130,246,0.2)`

### 弹层 `.qr-modal-shell` / `variant="preview"`

- 宽 `min(90vw, 1080px)` × 高 `min(90dvh, 810px)`，居中（非全屏宽条）
- **左 2/3**：参考作品，`object-contain` 按比例居中
- **右 1/3**：模板 / 细节 / 提示词 / 设置（比例 pill）/ 底栏 **复制**

## 5. 布局（QuickReplica 三栏）

- 左 220px 侧栏 · 中 kind/工作区 · 右模板库
- 面板头：border-bottom `--qr-border`，14px medium
- 卡片网格 gap 12–16px

## 6. Do / Don't

**Do**
- 用 CSS 变量 / `qr-*` 类，不硬编码 `#0a0a0a` / pink 渐变
- 选中态用 brand blue + 紫调 shadow
- 卡片大圆角 20px

**Don't**
- 不用粉紫渐变 CTA（旧 OpenArt 风格）
- 不用 `window.alert`
- 品牌粉勿用于主按钮文字

## 7. Agent 提示

改 UI 前读本文 + `globals.css` `@layer components`。新组件复用 `qr-btn-primary`、`qr-card`、`qr-input`。
