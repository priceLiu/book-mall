# 电商工具箱 · 弹出层（Dialog）

> 全站确认/提示/二次确认 **必须** Radix Dialog + 本规范样式；禁止自建 `fixed` 白盒（旧 `ModalPortal` 手写层已废弃）。

## 参考

- 组件：`components/ui/dialog.tsx`（Radix）
- 业务封装：`components/dialogs/dialog-provider.tsx` → `useDialogs()`
- 视觉：白底卡片、黑字标题、灰字说明、右上 **X**、底栏右对齐 **取消 + 主按钮**

## 主色（黑白蓝）

| 元素 | 色 |
|------|-----|
| 遮罩 | `bg-black/80` |
| 卡片 | `bg-white`，描边 `--ecom-hairline` |
| 标题 | `--ecom-ink` |
| 说明 | `--ecom-muted` |
| 取消 | 白底 + 灰描边 + 黑字 |
| 主操作 | **`--ecom-primary` 蓝** + 白字（destructive 用红） |

弹出层主按钮为 **圆角矩形 `rounded-md`**（非门户胶囊），见 `EcomDialogPrimaryButton` / `EcomDialogCancelButton`。

## 用法

```tsx
const { confirm, alert, doubleConfirm } = useDialogs();

if (!(await confirm({ title: "…", message: "…" }))) return;
await alert({ title: "…", message: "…" });
```

自定义内容：

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
```

## z-index

`z-[110]`（与旧版一致，高于顶栏）。

## 禁止

- `window.alert` / `window.confirm`
- 手写 `fixed inset-0` 弹层（须走 `Dialog` 或 `useDialogs`）
- 弹出层主按钮用黑色填充（须品牌蓝）
