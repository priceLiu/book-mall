# Platform API v1（冻结）

> Phase E/F：Book Mall 作为 Platform 的 SSO、准入与 Gateway 代理契约。  
> 产品背景：[12-platform-app-federation.md](../product/12-platform-app-federation.md)

## 认证概览

```text
用户浏览器 ──► Book 登录 (NextAuth)
子应用 / 第三方 ──► GET /api/sso/tools/re-enter ──► 302 子应用 /auth/sso/callback?code=
子应用服务端 ──► POST /api/sso/tools/exchange (Bearer TOOLS_SSO_SERVER_SECRET)
              ──► { access_token, expires_in }
子应用 ──► 存 tools_token Cookie；后续 API 带 Authorization: Bearer
```

## 端点

### `GET /api/sso/tools/re-enter`

| Query | 说明 |
|-------|------|
| `redirect` | 子应用内路径，默认 `/fitting-room` |
| `app` | `tool` \| `canvas` \| `story` \| `prompt-optimizer` |
| `client_id` | Phase F 注册客户端 ID |
| `redirect_uri` | 第三方回调（须在 client 白名单） |

未登录 → `/login?callbackUrl=…`；已登录 → 302 带 `code` 的 callback URL。

### `POST /api/sso/tools/exchange`

- **Auth**：`Authorization: Bearer {TOOLS_SSO_SERVER_SECRET}`
- **Body**：`{ "code": "…" }`
- **200**：`{ access_token, token_type: "Bearer", expires_in, tier, tools_nav_keys }`
- **403**：准入失败（无工具技术服务费）

### `POST /api/sso/tools/introspect`

- **Auth**：`Authorization: Bearer {access_token}`
- **200 字段**：`active`, `sub`, `tools_nav_keys`, `tool_service_periods`, `has_active_tool_service`, …

### Gateway 代理

| 路径 | 说明 |
|------|------|
| `POST /api/sso/tools/gateway/dashscope` | 试衣/文生图/视频等 |
| `POST /api/sso/tools/gateway/chat` | 流式 Chat |

**Auth**：`Authorization: Bearer {access_token}`  
**403**：`GATEWAY_KEY_REQUIRED` \| `TOOLS_ACCESS_DENIED` \| `FORBIDDEN_SUITE`

### Canvas / Story API

- 路径前缀：`/api/canvas/*`、`/api/story/*`
- **Auth**：NextAuth Cookie（迁移期）或 `Authorization: Bearer {access_token}`

## 错误码

| code | HTTP | 含义 |
|------|------|------|
| `TOOLS_ACCESS_DENIED` | 403 | 无有效工具技术服务费 |
| `FORBIDDEN_SUITE` | 403 | 无对应 navKey 服务期 |
| `GATEWAY_KEY_REQUIRED` | 403 | 未关联 Gateway sk-gw |
| `SSO_CLIENT_INVALID` | 403 | client_id 无效 |
| `SSO_CLIENT_NAV_DENIED` | 403 | 用户服务期与 client allowedNavKeys 无交集 |
| `SSO_REDIRECT_URI_INVALID` | 400 | redirect_uri 不在白名单 |

## 第三方接入（Phase F）

1. 管理后台 `/admin/sso-clients` 注册 `SsoClient`（`redirectUris` + 可选 `allowedNavKeys`）
2. 引导用户：`/api/sso/tools/re-enter?client_id=…&redirect_uri=…`
3. 回调页服务端 `POST /api/sso/tools/exchange` → JWT 内 `tools_nav_keys` 已与 client 范围取交集
4. 使用 `access_token` 调 Gateway / introspect

示例：`examples/platform-client/`（`pnpm dev` 可运行）

## 财务（Phase D）

- 课程订阅 **仅课程**；工具 **按月技术服务费**
- AI 生成 **不按次扣点**；云厂商 **Gateway BYOK**
