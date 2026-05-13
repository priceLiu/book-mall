# tool-web（独立工具站前端）

本目录与 **`book-mall/` 主站同级**（布局：`private_website/book-mall` + `private_website/tool-web`）。二者为 **两个 Next.js 进程**，需各自安装依赖与启动。Git 根目录为 **`private_website/`**，与本站一并版本管理；说明见 **[`../README.md`](../README.md)**。

## 为什么要单独跑？

- 独立迭代、独立扩容（未来可把推理 API 再拆一层）。
- 通过环境变量 `TOOLS_PUBLIC_ORIGIN` 与主站配置的跳转地址一致即可 SSO。

## 本地联调（最短路径）

1. **主站**（目录 `book-mall/`）：  
   - `.env.local` 中配置 `TOOLS_PUBLIC_ORIGIN=http://localhost:3001`（与浏览器访问工具站的 host **一致**，勿与 `127.0.0.1` 混用）  
   - 以及与下文一致的 `TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`  
   - `pnpm dev` → 默认 `http://localhost:3000`

2. **工具站**（本目录）：  
   - 复制 `.env.example` 为 `.env.local`，填入与主站相同的 **`TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`**（后者强烈建议配置）、`MAIN_SITE_ORIGIN=http://localhost:3000`  
   - `pnpm install`  
   - `pnpm dev` → 默认 `http://localhost:3001`

3. 浏览器登录主站 → 个人中心 → **打开试衣间**，或 **管理后台** → **工具站** → 默认落在本站 `/fitting-room`。

## 工具站自有配置（大模型 Key 等）

主站的 `.env.local`**不要**写工具推理 Key。请在 **`tool-web/.env.local`**（或由宿主注入进程环境变量）填写；变量名模板见 **`config/tool-web.env.example`**。

代码入口：**`lib/tool-config.ts`**（仅服务端读取）。新增调用上游模型的 Route Handler 时从这里取 Key / Base URL / 模型名即可。

| 路径 | 说明 |
|------|------|
| `/auth/sso/callback` | 接收主站跳转的 `code`，服务端换票并写入 HttpOnly Cookie |
| `/fitting-room` | 试衣间（页面级仍可 introspect；壳层优先 JWT） |
| `/text-to-image` | 文生图 |
| `/text-to-image/implementation` | 文生图 · 实现逻辑（摘录） |
| `/fitting-room/implementation` | 试衣间套装 · 实现逻辑 |
| `/fitting-room/ai-fit/implementation` | AI试衣 · 实现逻辑 |
| `/smart-support` | 智能客服首页（Hero + 入口） |
| `/smart-support/chat` | 我的智能客服（DeepSeek + Dify） |
| `/smart-support/sessions` | 会话归档占位（侧栏无入口，保留路由） |
| `/smart-support/implementation` | 智能客服 · 实现逻辑 |
| `/sso-error` | 换票失败提示 |

完整协议见 [`../book-mall/doc/tech/tools-sso-environment.md`](../book-mall/doc/tech/tools-sso-environment.md)。

## UI 与文档

- **壳层**：左侧「工具列表」+ 顶栏用户信息 / 重新连接；大屏侧栏、小屏抽屉（见 `components/tool-shell-client.tsx`、`app/globals.css`）。
- **站内文档**：[`doc/README.md`](doc/README.md)（产品概述、SSO 排障、布局与移动端、`pnpm build` 部署流程）。
- **Cursor 规则**：[`tool-web-dev`](./.cursor/rules/tool-web-dev.mdc)。
