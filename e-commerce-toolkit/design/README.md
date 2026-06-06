# 电商工具箱 · 设计文档

> **全站统一入口**：[SYSTEM.md](./SYSTEM.md)（基本样式规划、按钮五层、禁止清单、组件映射）

## 文档地图

| 文档 | 说明 |
|------|------|
| **[SYSTEM.md](./SYSTEM.md)** | **母规范**：色彩、排版、按钮体系、聊天/表/图总览 |
| [COLORS.md](./COLORS.md) | 黑白蓝语义色 |
| [DESIGN.md](./DESIGN.md) | Apple 风格 token（色、字、圆角、间距） |
| [LAYOUT.md](./LAYOUT.md) | AppShell、双栏工作台、StepSection |
| [BUTTON.md](./BUTTON.md) | 胶囊主按钮 / 次按钮（Tier 1–2） |
| [CHAT.md](./CHAT.md) | 创作助手：气泡、输入、Choice Chip |
| [TABLE.md](./TABLE.md) | 数据表、字段行、导出版表格 |
| [MEDIA.md](./MEDIA.md) | 缩略图、上传、预览、浮层图标 |
| [DIALOG.md](./DIALOG.md) | Radix 弹出层、`useDialogs` |
| [VIDEO.md](./VIDEO.md) | 原生视频播放 |

## 实现对照

| 能力 | 代码位置 |
|------|----------|
| 主/次按钮 | `components/ui/ecom-button.tsx` |
| 弹出层 | `components/ui/dialog.tsx` + `components/dialogs/dialog-provider.tsx` |
| 工作台布局 | `components/layout/ecom-workspace-layout.tsx` |
| 助手 Choice | `components/storyboard/storyboard-assistant-choices.tsx` |
| 参考上传 | `components/storyboard/storyboard-ref-uploader.tsx` |
| 图片预览 | `components/media/ecom-image-preview-dialog.tsx` |
| 视频 | `components/media/ecom-video-player.tsx` |
| 生图/生视频模型选择 | `components/storyboard/storyboard-model-picker-dialog.tsx` |
| CSS 变量 | `app/globals.css` |

## Cursor 规则

- `.cursor/rules/ecom-design-system.mdc` — UI 母规范
- `.cursor/rules/ecom-model-picker.mdc` — **模型选择器唯一实现**（生图/生视频弹层，禁止另写）
