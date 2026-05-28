# Platform Client 示例（Phase F）

最小第三方接入演示：从 Book 换票并调用 introspect。

## 前置

1. book-mall 管理后台 `/admin/sso-clients` 注册：
   - `client_id`: `local-demo`
   - `redirect_uris`: `http://localhost:3010/callback`
   - `allowedNavKeys`（可选）：限制该 client 可获得的 navKey 子集
2. 复制 `book-mall/.env.local` 中的 `TOOLS_SSO_SERVER_SECRET` 到本目录 `.env.local`（见 `.env.example`）

## 运行

```bash
cd examples/platform-client
cp .env.example .env.local
# 编辑 .env.local 填入 TOOLS_SSO_SERVER_SECRET
pnpm dev
```

浏览器打开 http://localhost:3010 ，点击「使用 Book SSO 登录」（须已在 Book 主站登录且开通工具技术服务费）。

## 流程

1. 用户点击登录 → 302 到 Book `GET /api/sso/tools/re-enter?client_id=…&redirect_uri=…`
2. Book 签发 `code` → 302 回本应用 `/callback`
3. 服务端 `POST /api/sso/tools/exchange`（Bearer `TOOLS_SSO_SERVER_SECRET`）→ 写入 `platform_demo_token` Cookie
4. 首页调用 `GET /api/sso/tools/introspect` 展示 `tools_nav_keys`

## 生产注意

- **切勿**在前端暴露 `TOOLS_SSO_SERVER_SECRET`
- `redirect_uri` 必须 HTTPS 且在白名单内
- 用户须满足工具技术服务费；若 client 配置了 `allowedNavKeys`，JWT 内 navKey 为与用户服务期的交集

## 相关文档

- [platform-api-v1.md](../../book-mall/doc/tech/platform-api-v1.md)
- [12-platform-app-federation.md](../../book-mall/doc/product/12-platform-app-federation.md)
