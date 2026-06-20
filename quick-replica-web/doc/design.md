# QuickReplica UI 设计规范

> **视觉真源**：[`DESIGN.md`](../DESIGN.md)（MiniMax · awesome-design-md Dark 变体）  
> **Agent Skill**：`.cursor/skills/quick-replica-minimax/SKILL.md`  
> 产品文档：[book-mall/doc/product/quick-replica-platform.md](../../book-mall/doc/product/quick-replica-platform.md)

## 布局（三栏）

| 断点 | 结构 |
|------|------|
| `lg+` | 左栏 220px · **中栏** kind 网格 / 工作区 · **右栏** 模板网格，`h-dvh` |
| `< lg` | 底 Tab + 右栏模板；左栏抽屉 |

## 设计 token（摘要）

见 `DESIGN.md` 与 `app/globals.css` 中 `--qr-*`、`qr-*` 类。主色 brand blue `#3b82f6`；卡片圆角 20px；主按钮 `qr-btn-primary`。

## 组件

| 组件 | 路径 |
|------|------|
| `QrAppClient` | 三栏状态机 |
| `QrSidebar` | 左栏导航 |
| `QrKindBrowsePanel` | 中栏 kind 卡片网格 |
| `QrWorkspacePanel` | 中栏工作区 + 产生 |
| `QrTemplateGallery` | 右栏模板 |
| `QrTemplatePreviewModal` | 预览 + 复制（80% 正方形弹层） |
| `QrGeneratePreviewModal` | 产生完成 |
| `QrModal` | portal 弹层 |

## 交互

- 右栏点模板 → 预览 → **复制** → 中栏 workspace
- 中栏 **产生** → 轮询 → 预览 → 入库 prepend 右栏
- 禁止 `window.alert` → `QrModal`
