# 个人中心 · 主按钮尺寸

全站 `Button` 的 `size` 仅 **sm | md | lg** 三档（`icon` 仅图标，不计入）。

## 页面约束

- **同一页面主按钮最多 2 档**（例如 `sm + md`），禁止 sm / md / lg 同页混用。
- 推荐：列表/卡片/表格用 **sm**；区块主 CTA 用 **md**；站外营销/支付页可用 **lg**。
- 侧栏「退出登录」等布局壳与主区合计仍不超过两档（常见：`sm` 链 + `md` 主操作）。

## 尺寸表

| 档位 | 高度 | 水平内边距 | 字号 | 最小宽度 |
|------|------|------------|------|----------|
| **sm** | `h-8` | `px-3` | `text-sm` | `min-w-[calc(5.5em+1.5rem)]`（≥5 汉字） |
| **md** | `h-9` | `px-4` | `text-sm` | — |
| **lg** | `h-11` | `px-6` | `text-base` | — |

常量：`lib/button-sizes.ts` → `BUTTON_SM_MIN_CLASS`。

## 代码

```tsx
import { accountInlineLinkClass } from "@/components/account/account-nav-styles";

<Button variant="subscription" size="sm">开通月费</Button>
<Link className={accountInlineLinkClass()}>充值</Link>
<Button variant="subscription" size="md">AI 学堂</Button>
```

## 禁止

- `className` 覆盖 `h-*` / `px-*` / `text-*` / `min-w-*` 造第四档
- `size="default"`（已移除）
- 单页出现三档尺寸

`.account-center a.text-primary` 与 **sm** 对齐，见 `app/globals.css`。
