# 提示词优化器 · 视觉与平台约束

> 上游 UI：Vue 3 + Naive UI + Tailwind。平台版 **保留 upstream 视觉**，不重写为 Next 业务页。

## 色板（Naive UI 主题 · 暗色为主）

| 用途 | 参考 |
|------|------|
| 页面背景 | `#0f1117` ~ `#18181c` |
| 卡片/面板 | 半透明白 `rgba(255,255,255,0.03)` + 细边框 |
| 主色/链接 | `#7c9cff`（与 Gateway `--gw-accent` 接近） |
| 正文 | `#e8eaed` |
| 次要文字 | `rgba(232,234,237,0.65)` |
| 错误 | `#ff8a8a` |

## 布局

- 顶栏：应用名 + 外链（主站账户、Gateway 模型管理）
- 主区：上游三栏/双栏工作区（优化 / 对比 / 测试）
- 模型管理弹窗：Tab（文本 / 图像 / 功能）

## 平台版交互差异

1. **Model Manager**：不展示 API Key / Base URL 编辑；顶部提示跳转 **gateway-web** `/dashboard/models`
2. **不添加**自带厂商凭证表单；禁用「添加模型」写 Key 流程（文本/图像）
3. 默认文本模型：`platform-gateway/default` → Gateway 路由 `deepseek-chat`（可在 Gateway 启用其它模型后于 UI 切换 modelId）

## 组件

- Naive UI：`NModal`、`NTabs`、`NButton`、`NAlert`、`NForm`
- 图标：内联 SVG + Lucide（upstream）

## 状态色

- 成功：Naive `success`
- 警告：Naive `warning`
- 信息：Naive `info`（平台 Gateway 引导条）

## 引用

- Gateway Model Manager 规格：`gateway-web/docs/design.md` §6
- 平台架构：`docs/prompt-optimizer.md`
