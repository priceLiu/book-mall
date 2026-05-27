# Gateway BYOK 代理路由

独立站点 **gateway-web**（默认 `:3005`）：用户绑定厂商 Key，平台签发 `sk-gw-*`，代理到 KIE / 百炼 / DeepSeek，记录 token 与挂牌价估算。

## 本地启动

```bash
# 根目录（含 gateway-web + gateway-poll-loop）
pnpm dev:all

# 或单独
pnpm --dir book-mall dev
pnpm --dir gateway-web dev
pnpm --filter book-mall run gateway:poll-loop
```

打开 http://localhost:3005

## 环境变量

| 位置 | 变量 |
|------|------|
| book-mall `.env.local` | `DATABASE_URL`、`CANVAS_SECRET_KEY`（加密厂商 key）、`GATEWAY_JWT_SECRET`、`GATEWAY_SSO_SERVER_SECRET`、`GATEWAY_PUBLIC_ORIGIN` |
| gateway-web `.env.local` | `BOOK_MALL_ORIGIN`、`GATEWAY_PUBLIC_ORIGIN`、`GATEWAY_SSO_SERVER_SECRET`（与 book 一致） |

`GATEWAY_JWT_SECRET` / `GATEWAY_SSO_SERVER_SECRET` 可与现有 `TOOLS_SSO_*` 相同，便于开发。

## 数据库

Gateway 表在 **book-mall Prisma**（迁移 `20260526130000_gateway_byok_tables`）。迁移前备份：

```bash
bash scripts/backup-db.sh
# 或腾讯云控制台手动备份
```

## 用户需知

完整流程、**Book ↔ Gateway 入口**与用量说明：

- 控制台界面：**用户需知**（`/dashboard/guide`）
- 产品文档：`book-mall/doc/product/gateway-user-guide.md`

## 用户同步与登录入口

| 场景 | 入口 |
|------|------|
| Book → Gateway（推荐） | Book 个人中心 `#gateway-api-key` → **「用 Book 账号打开 Gateway」** |
| Gateway → Book SSO | Gateway `/login` → **「使用 Book 账号登录」** |
| SSO API | Book `GET /api/sso/gateway/issue?redirect=/dashboard/credentials` |

- Book 注册 → 自动 `GatewayUser`（`BOOK_SYNC`）
- Gateway 本地注册 → 仅 `LOCAL`，且 **不可** 使用已在 Book 注册的邮箱
- Book 密码 **不同步** 到 Gateway；Book 用户请走 SSO，勿用 Gateway 邮箱密码框

## 对外 API

Base URL（经 gateway-web 代理）：`http://localhost:3005/api/v1`

```bash
curl http://localhost:3005/api/v1/chat/completions \
  -H "Authorization: Bearer sk-gw-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}]}'
```

异步 KIE 任务：`POST /api/v1/jobs/createTask`、`GET /api/v1/jobs/recordInfo?taskId=...`

## 与 canvas/story 回调

Gateway 使用独立 poll-loop 与 callback 路径，**不修改** canvas/story 现有 KIE 回调与 poll-loop。
