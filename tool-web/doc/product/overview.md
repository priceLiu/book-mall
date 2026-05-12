# 产品概述 — AI 工具站（tool-web）

## 定位

- **独立 Next.js 应用**，与主站 `book-mall` 分进程部署，通过 **工具站 SSO** 获取短时访问令牌并写入 HttpOnly Cookie（`tools_token`）。
- 工具页（试衣间、文生图等）在此迭代；主站负责账号、会员与签发入口。

## 用户路径

1. 用户在主站已登录，从 **个人中心** 或 **管理后台「工具站」** 等入口触发跳转（`re-enter` / `issue` 流程）。
2. 浏览器经主站校验资格后跳到工具站 `/auth/sso/callback`，服务端换票并落 Cookie。
3. 工具站各页通过服务端调用主站 **`GET /api/sso/tools/introspect`** 复核 `active`、角色与展示字段（含 `email`、`name`）。

## 功能需求（当前与扩展）

- **工作台**：默认首页，说明导航与重连方式。
- **试衣间** (`/fitting-room`)：套装列表与详情弹层；**试穿**跳转 **AI 试衣**并预填服装（详见 [fitting-room-and-ai-fit.md](./fitting-room-and-ai-fit.md)）。
- **AI 试衣** (`/fitting-room/ai-fit`)：模特与服装配置、异步试衣与结果展示；支持从试衣间带 `id` 预填。
- **文生图** (`/text-to-image`)：占位；推理 Key 仅服务端 `lib/tool-config.ts` 读取。
- **新增工具**：在 `config/nav-tools.ts` 的 `TOOL_NAV_ITEMS` 注册 href 与文案；复杂交互优先服务端 Route Handler。

## 非目标

- 不在工具站复制主站完整账号体系；登录与会员仍以主站为准。
- 不把上游模型 Key 暴露给浏览器。

## 相关文档

- [../tech/sso-session-troubleshooting.md](../tech/sso-session-troubleshooting.md)
- [../tech/layout-and-responsive.md](../tech/layout-and-responsive.md)
- [../process/deployment.md](../process/deployment.md)
