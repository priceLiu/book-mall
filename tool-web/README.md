# tool-web（独立工具站前端）

本目录与 **`book-mall/` 主站同级**（常见布局：`private_website/book-mall` + `private_website/tool-web`）。二者为 **两个 Next.js 进程**，需各自安装依赖与启动。若 Git 根仅在 `book-mall/` 内，则上级目录中的本仓库不会被跟踪——见 **[`../README.md`](../README.md)**。

## 为什么要单独跑？

- 独立迭代、独立扩容（未来可把推理 API 再拆一层）。
- 通过环境变量 `TOOLS_PUBLIC_ORIGIN` 与主站配置的跳转地址一致即可 SSO。

## 本地联调（最短路径）

1. **主站**（目录 `book-mall/`）：  
   - `.env.local` 中配置 `TOOLS_PUBLIC_ORIGIN=http://127.0.0.1:3001`  
   - 以及与下文一致的 `TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`  
   - `pnpm dev` → 默认 `http://localhost:3000`

2. **工具站**（本目录）：  
   - 复制 `.env.example` 为 `.env.local`，填入与主站相同的两个 Secret、`MAIN_SITE_ORIGIN=http://localhost:3000`  
   - `pnpm install`  
   - `pnpm dev` → 默认 `http://127.0.0.1:3001`

3. 浏览器登录主站 → 个人中心 → **打开试衣间** → 应落在本站的 `/fitting-room`。

## 路由约定

| 路径 | 说明 |
|------|------|
| `/auth/sso/callback` | 接收主站跳转的 `code`，服务端换票并写入 HttpOnly Cookie |
| `/fitting-room` | 试衣间占位页（调用主站 introspect 展示会话） |
| `/sso-error` | 换票失败提示 |

完整协议见 [`../book-mall/doc/tech/tools-sso-environment.md`](../book-mall/doc/tech/tools-sso-environment.md)。
