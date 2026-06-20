---
name: quick-replica-minimax
description: >-
  QuickReplica UI 遵循 awesome-design-md MiniMax 设计系统（Dark 变体）。
  Use when editing quick-replica-web components, modals, cards, sidebar, or when
  the user mentions QuickReplica design, minimax, awesome-design-md, or 快速复制样式.
---

# QuickReplica · MiniMax Design Skill

## 何时加载

- 修改 `quick-replica-web/**` 任意用户可见 UI
- 新增弹层、卡片、侧栏、工作区表单
- 用户要求对齐 MiniMax / awesome-design-md / DESIGN.md

## 必读真源

1. **`quick-replica-web/DESIGN.md`** — 色板、圆角、Do/Don't
2. **`quick-replica-web/app/globals.css`** — `--qr-*` 变量与 `qr-*` 组件类

上游参考：[awesome-design-md/minimax](https://github.com/asadravian/awesome-design-md-google-stitch/tree/main/design-md/minimax)

## 硬性规则

| 场景 | 用法 |
|------|------|
| 主 CTA（产生/复制/完成） | `qr-btn-primary` |
| 次操作（关闭/返回） | `qr-btn-secondary` |
| 模板/kind 卡片 | `qr-card` · 选中 `qr-card-selected` |
| 表单 | `qr-input` |
| 弹层容器 | `qr-modal-shell` |
| 导航选中 | `qr-nav-active` / `qr-nav-category-active` |
| 置顶/new | `qr-badge-pin` / `qr-badge-new`（粉 `#ea5ec1` 仅装饰） |

**禁止**：粉紫渐变 `from-pink-600 to-violet-600`、硬编码 `#0a0a0a`/`#141414`、`window.alert`

## 布局（不变）

三栏：左导航 · 中 kind/工作区 · 右模板。详见 `doc/design.md` 交互；视觉 token 以 `DESIGN.md` 为准。

## 改 UI 流程

1. 读 `DESIGN.md` §2 tokens
2. 优先复用 `globals.css` 已有 `qr-*` 类；缺失时 **先扩展 globals**，再在 TSX 引用
3. 字体：DM Sans 正文；Outfit 仅大标题（可选）
4. 卡片圆角 **20px**；按钮 **8px**；导航 pill **9999px**

## Code Review 清单

- [ ] 无旧 OpenArt 粉紫渐变主按钮
- [ ] 选中卡片有 brand blue + `--qr-shadow-brand`
- [ ] 输入框 focus 有 blue ring
- [ ] 弹层 80vmin 正方形逻辑保留（`QrModal variant="square"`）
- [ ] 确认/提示走 `QrModal`，非原生 dialog

详细 token 表 → [reference-tokens.md](reference-tokens.md)
