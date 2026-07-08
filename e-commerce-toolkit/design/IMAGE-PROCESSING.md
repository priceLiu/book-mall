# 电商工具箱 · 图像处理配色（对齐微剧故事版）

图像处理工作台（`e-commerce-toolkit/components/image-processing/**`）与全站电商 UI 共用下列规则，**禁止**使用绿色作为主操作色。

## 主操作蓝

| 用途 | 类名 / Token |
|------|----------------|
| 主 CTA 按钮 | `bg-[#0071e3] hover:bg-[#0066cc]` 或 `ipCtaButtonClass` |
| 选中胶囊 / 标签 | `border-[#0071e3] bg-[#0071e3] text-white` → `ipTagSelectedClass` |
| 未选中胶囊 | `border-[#e5e5ea] bg-white text-[#1d1d1f]` → `ipTagUnselectedClass` |
| 长宽比选中 | `border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]` → `ipAspectSelectedClass` |
| 链接 / 高级选项 | `text-[#0071e3]` |

权威 Token：`--ecom-primary` `#0066cc`、`--ecom-primary-focus` `#0071e3`（见 `COLORS.md`）。

## 步骤序号（黑底）

教程与「如何使用」中的圆形序号：

- **背景**：`#000000`（`--ecom-tile`）
- **文字**：白色
- 实现：`ipStepNumberClass`（`lib/image-processing-theme.ts`）

## 禁止

- 主按钮、选中态使用 `emerald-*` / `green-*`
- 步骤序号使用蓝色或绿色圆形背景

## 参考实现

- 主题常量：`e-commerce-toolkit/lib/image-processing-theme.ts`
- CTA 默认：`ImageProcessingCtaButton`（`variant` 默认 `"blue"`）
- 风格参考上传：统一 `ImageSingleUpload`（含 `compact` 模式）
