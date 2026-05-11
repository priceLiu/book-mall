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
| `TOOLS_SSO_JWT_SECRET` | 若工具站本地验 JWT，与主站一致；否则可仅凭 introspect |

## 主站 HTTP API

| 方法 | 路径 | 调用方 | 说明 |
|------|------|--------|------|
| `POST` | `/api/sso/tools/issue` | 主站浏览器（已登录） | Body 可选 `{ redirectPath?: string }`，默认 `/fitting-room`；返回 `{ redirectUrl, codeTtlSeconds }` |
| `POST` | `/api/sso/tools/exchange` | 工具站 **服务端** | Header `Authorization: Bearer TOOLS_SSO_SERVER_SECRET`；Body `{ code }`；返回 OAuth 式 `{ access_token, expires_in, token_type, token_subtype }` |
| `GET` | `/api/sso/tools/introspect` | 工具站 **服务端** | Header `Authorization: Bearer <access_token>`；返回 `active`、`balance_minor` 等；权限丢失时 `active: false` |

## 数据库

表 **`SsoAuthorizationCode`**：一次性 code，含 `expiresAt`、`consumedAt`。迁移见 `prisma/migrations/20260511180000_sso_tools_authorization_code/`。

## 本仓库配套工具站（与 `book-mall/` 同级：`tool-web/`）

最小可运行 Next 应用：[**`../../../tool-web/README.md`**](../../../tool-web/README.md)。本地典型配置：`TOOLS_PUBLIC_ORIGIN=http://127.0.0.1:3001`（主站）、`MAIN_SITE_ORIGIN=http://localhost:3000`（工具站）。

若 Git 根目录仅在 `book-mall`，上级 **`tool-web`** 不会随远端 clone；请把仓库根上移至共同父目录，或将工具站单独维护——见 **[`README.md`](../../../README.md)**（`private_website` 根目录说明）。

## 相关文档

- [`../v1.1`](../v1.1)  
- [`../logic/tools-sso-session.md`](../logic/tools-sso-session.md)  
- [`../product/08-independent-tools-sso.md`](../product/08-independent-tools-sso.md)
