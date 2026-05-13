# 部署与开发流程（tool-web）

## 仓库结构

- Git 根目录：`private_website/`（同时包含 `book-mall` 与 `tool-web`）。
- 工具站目录：`tool-web/`；依赖单独安装、单独构建。

## 环境变量（工具站）

| 变量 | 说明 |
|------|------|
| `MAIN_SITE_ORIGIN` | 主站根 URL，无末尾 `/` |
| `TOOLS_PUBLIC_ORIGIN` | 与主站 `TOOLS_PUBLIC_ORIGIN` **完全相同**；生产必填，用于 `/auth/sso/callback` 重定向（Docker 内勿依赖 `request.nextUrl.origin`，常为 `http://0.0.0.0:3001`） |
| `TOOLS_SSO_SERVER_SECRET` | 与主站一致；服务端 `exchange` 使用 |
| `TOOLS_SSO_JWT_SECRET` | 若本地验 JWT，与主站一致 |

可选：`TOOL_WEB_*`，模板见 `config/tool-web.env.example`，读取 `lib/tool-config.ts`。

主站侧 **`TOOLS_PUBLIC_ORIGIN`** 与工具站侧 **`TOOLS_PUBLIC_ORIGIN`** 须 **完全一致**，且与浏览器访问的工具站 origin **一致**（含协议与 host）。

## 本地联调（最短）

1. 主站 `book-mall`：`TOOLS_PUBLIC_ORIGIN` 指向工具站 dev URL（如 `http://localhost:3001`，与浏览器访问工具站的 host 一致），配置两个 Secret，`pnpm dev`（常见 `:3000`）。
2. 工具站 `tool-web`：复制 `.env.example` → `.env.local`，`MAIN_SITE_ORIGIN` 指向主站，`pnpm install && pnpm dev`。

从主站 **个人中心 / 管理后台** 打开工具入口，完成 callback 后再访问各工具页。

## 构建与检查

```bash
cd tool-web
pnpm lint
pnpm build
```

生产环境由宿主注入上述环境变量；确保 HTTPS、Cookie `Secure` 策略与文档一致（按 Next 与部署平台配置）。

## 文档与规则

- 索引：[README](../README.md)
- Cursor 规则：`tool-web/.cursor/rules/tool-web-dev.mdc`
