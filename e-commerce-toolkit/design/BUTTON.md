# 电商工具箱 · 按钮规范（Tier 1–2）

> 全站按钮 **五层体系** 见 [SYSTEM.md](./SYSTEM.md) §5。本文仅覆盖 **主胶囊** 与 **次胶囊**（Tier 1–2）。  
> 页面工具条、助手 Choice Chip、图标按钮见 SYSTEM / [CHAT.md](./CHAT.md) / [MEDIA.md](./MEDIA.md)。

> 全站主操作、对话框确认、门户 CTA **必须**使用本规范组件，禁止散落自定义 `bg-blue-*` / `rounded-md` 主按钮。

## 参考实现

- 组件：`components/ui/ecom-button.tsx`
- 兼容导出：`components/ui/button-primary.tsx` → `EcomButtonPrimary`
- 动效：`framer-motion` spring（`duration: 0.6`, `type: 'spring'`）
- 形态：全圆角胶囊（`border-radius: 999px`），见图示 Submit 药丸按钮

## 设计 Token（`app/globals.css`）

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--ecom-btn-fill` | `var(--ecom-primary)` | 主按钮填充（品牌蓝 `#0066cc`） |
| `--ecom-btn-on-fill` | `#ffffff` | 主按钮文字 |
| `--ecom-btn-alt-fill` | `#f4f4f5` | 翻转后面填充（浅灰） |
| `--ecom-btn-alt-on-fill` | `#18181b` | 翻转后面文字 |
| `--ecom-primary` | `#0066cc` | 品牌主色（与 `design/DESIGN.md` 一致） |

原型稿示例曾用 `#3b82f6`；**以 `--ecom-primary` 为准**，勿在业务代码写死 hex。

## 组件一览

### 1. `EcomButtonPrimary`（默认主按钮）

- 单态：品牌蓝底白字、圆角 999、`font-medium`；尺寸见上表 `size`
- 交互：`whileHover scale 1.05`、`whileTap scale 0.95`
- 用法：`<EcomButtonPrimary>开始制作</EcomButtonPrimary>`

### 2. 加载 / 双文案翻转

传入 `altLabel` + `flipActive`（受控，**不**在点击时自动翻转）：

```tsx
<EcomButtonPrimary altLabel="生成中…" flipActive={busy} disabled={busy} onClick={handleGenerate}>
  生成
</EcomButtonPrimary>
```

- `flipActive={false}` → 显示子文案（正面）
- `flipActive={true}` → 显示 `altLabel`（背面，浅灰底深字）

### 3. `EcomFlipButton`（双文案手动翻转）

用于演示或显式切换两种状态（点击可 `onToggle`）：

```tsx
<EcomFlipButton text1="已提交" text2="提交" active={show} onToggle={setShow} />
```

### 4. `EcomButtonSecondary`（描边胶囊）

白/透明底 + 主色描边与文字，无翻转。门户「了解更多」等次要 CTA。

## 尺寸（仅 sm | md | lg）

定义：`lib/ecom-button-sizes.ts`；组件传 `size` prop，**禁止** `!px-*` / `!py-*` / `min-w-*` 覆盖。

### 页面约束

- **同一页面主按钮最多 2 档**（如门户整页仅 `lg`；工作台 `sm` 侧栏登录 + `md` 生成）。
- 禁止 sm / md / lg 三档同屏。

### 尺寸表

| 档位 | 内边距 | 字号 | 最小宽度 | 典型场景 |
|------|--------|------|----------|----------|
| **sm** | `px-4 py-2` | `text-sm` | `min-w-[calc(5.5em+1.5rem)]`（≥5 汉字） | Dialog、侧栏「登录」 |
| **md** | `px-5 py-2.5` | `text-sm` | — | 工作台「生成」（默认） |
| **lg** | `px-6 py-3` | `text-base` | — | 门户「开始制作」、次要描边链 |

`fullWidth` → `w-full max-w-[270px]`（宽度上限，非尺寸档）。

## 使用场景映射

| 场景 | 组件 |
|------|------|
| 门户「开始制作」 | `EcomButtonPrimary size="lg"` |
| 工作台「生成」 | `EcomButtonPrimary size="md"` + `altLabel` / `flipActive` |
| Dialog 确认 / 知道了 | `EcomButtonPrimary size="sm"` |
| Dialog 取消 | 文字按钮（`text-muted`），非主按钮 |
| 侧栏「登录」 | `ecomPrimaryLinkClass("sm")`（`<a>`，不可嵌套 button） |
| destructive 删除 | 保留红色文字按钮（资产库等），**不**用主按钮翻转 |

## 禁止

- 主 CTA 使用 `Button` / 原生 `<button>` + 自写 `bg-[var(--ecom-primary)]`（须走 `EcomButtonPrimary`）
- 主色使用 Tailwind `bg-blue-500` 硬编码
- 方角主按钮（主操作必须 `rounded-full` / 999）
- 单页三档尺寸；sm 未走 token 导致不足 5 字宽

## 与 Book 主站关系

Book 个人中心橙色 `subscription` 按钮 **仅用于 book-mall**（尺寸见 `book-mall/components/account/ACCOUNT-BUTTON.md`）；电商工具箱独立品牌色，**不**复用橙色翻转规范。
