# 独立工具站 SSO — 环境变量与接口

## 环境变量（主站）

| 变量 | 必填 | 说明 |
|------|------|------|
| `TOOLS_PUBLIC_ORIGIN` | 接入工具站时 **必填** | 工具站站点根 URL，无末尾 `/`。例：`https://tools.ai-code8.com`；本地可为 `http://127.0.0.1:3001` |
| `TOOLS_SSO_SERVER_SECRET` | **必填** | 随机长字符串（≥16）；工具站 **服务端** 调用 `exchange` 时 `Authorization: Bearer <值>` |
| `TOOLS_SSO_JWT_SECRET` | **必填** | JWT HS256 密钥（≥16）；主站签名，工具站 **若自行验签** 须配置同一值（建议只在服务端） |
| `TOOLS_SSO_CODE_TTL_SECONDS` | 否 | 授权码 TTL，30–300，默认 **90** |
| `TOOLS_SSO_JWT_TTL_SECONDS` | 否 | JWT TTL，120–7200，默认 **600** |

**勿将 `TOOLS_SSO_SERVER_SECRET` / `TOOLS_SSO_JWT_SECRET` 提交仓库或泄露给前端。**

## 环境变量（工具站服务端）

| 变量 | 说明 |
|------|------|
| `MAIN_SITE_ORIGIN` | 主站 origin，无末尾 `/`。例：`https://www.ai-code8.com` |
| `TOOLS_SSO_SERVER_SECRET` | 与主站 **完全一致** |
| `TOOLS_SSO_JWT_SECRET` | **强烈建议与主站一致**：服务端 **`resolveToolsShellSession`** 优先本地验签 JWT（内含 `email`/`name`/`image` 裁剪字段）；未配置或验签失败时壳层降级为 **`GET introspect`** |
| `TOOL_WEB_*` | **可选**：大模型 / 兼容接口 Key、Base URL、模型名等；仅写在工具站 `.env.local`，模板见 **`tool-web/config/tool-web.env.example`**，读取 **`tool-web/lib/tool-config.ts`** |

## 主站 HTTP API

| 方法 | 路径 | 调用方 | 说明 |
|------|------|--------|------|
| `POST` | `/api/sso/tools/issue` | 主站浏览器（已登录） | Body 可选 `{ redirectPath?: string }`，默认 `/fitting-room`；**黄金会员或管理员**可换取跳转；返回 `{ redirectUrl, codeTtlSeconds }` |
| `GET` | `/api/sso/tools/re-enter` | 浏览器（工具站过期引导） | Query：`redirect`（工具站内路径，默认 `/fitting-room`，须以 `/` 开头）。已登录则直接 302 至工具站 callback；未登录则 302 至 `/login?callbackUrl=…` 登录后再回到本接口签发跳转。**新标签直达本接口时浏览器会先显示 `about:blank`**，可从主站页面改为先打开 **`/tools-open?redirect=/路径`**（加载动画后再跳转本接口）。 |
| `POST` | `/api/sso/tools/exchange` | 工具站 **服务端** | Header `Authorization: Bearer TOOLS_SSO_SERVER_SECRET`；Body `{ code }`；返回 OAuth 式 `{ access_token, expires_in, token_type, token_subtype }`。JWT Payload 除 `sub`、`tier`、`exp` 外写入裁剪后的 **`email` / `name` / `image`**（供工具站壳层本地验签展示）。 |
| `GET` | `/api/sso/tools/introspect` | 工具站 **服务端** | Header `Authorization: Bearer <access_token>`；返回 `active`、`tools_role`（`admin` / `member`）、`balance_minor`、`email`、`name`、`image`（头像 URL，OAuth 常见；可为 `null`）等；权限丢失时 `active: false` |
| `POST` | `/api/sso/tools/usage` | 工具站 **服务端或浏览器（经 `/api/tool-usage` 代理）** | Header `Authorization: Bearer <access_token>`；Body：`toolKey`、`action`（默认 `page_view`）、可选 `meta`（JSON 对象）、可选 `costMinor`（分）。AI 试衣 `try_on` 可按平台 **`PlatformConfig.toolInvokePerCallMinor`** 自动写入 `costMinor`。 |
| `GET` | `/api/sso/tools/usage` | 工具站 **服务端（经 `/api/tool-usage`）** | 同上 Bearer；Query：`limit`（默认 50，最大 100）、可选 `toolKeyPrefix`。返回 `{ events: [...] }`，供「应用历史」页。 |

**吊销黄金会员、余额线变更等「实时权威」仍以 `GET /api/sso/tools/introspect` 为准**；JWT 仅在 TTL 内视为壳层展示与路由占位可信源，缩短 TTL（`TOOLS_SSO_JWT_TTL_SECONDS`）可收窄滞后窗口。

## 数据库

表 **`SsoAuthorizationCode`**：一次性 code，含 `expiresAt`、`consumedAt`。迁移见 `prisma/migrations/20260511180000_sso_tools_authorization_code/`。

表 **`ToolUsageEvent`**：工具站打点（`toolKey` / `action` / `meta` / `costMinor`）。迁移见 `prisma/migrations/20260511210000_tool_usage_event/` 及 **`20260513180000_tool_usage_cost_minor`**（`costMinor` 列）。

## 本仓库配套工具站（与 `book-mall/` 同级：`tool-web/`）

最小可运行 Next 应用：[**`../../../tool-web/README.md`**](../../../tool-web/README.md)。本地典型配置：`TOOLS_PUBLIC_ORIGIN=http://127.0.0.1:3001`（主站）、`MAIN_SITE_ORIGIN=http://localhost:3000`（工具站）。

**Git 根目录**为本仓库 **`private_website/`**，clone / push 会同时包含 `book-mall` 与 `tool-web`。仓库约定说明见 **[`README.md`](../../../README.md)**。

## 相关文档

- [`../v1.1`](../v1.1)  
- [`../logic/tools-sso-session.md`](../logic/tools-sso-session.md)  
- [`../product/08-independent-tools-sso.md`](../product/08-independent-tools-sso.md)
