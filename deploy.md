# 部署指南（生产：腾讯云托管 / 开发：本机）

本仓库三个 Next.js 工程：

| 工程 | 角色 | 开发端口 | 生产域名（示例）|
|------|------|---------|---------------|
| `book-mall` | 主站（认证 / 钱包 / 工具 SSO / 财务 API / 管理后台） | `3000` | `book.ai-code8.com` |
| `tool-web` | 工具站（试衣 / 文生图 / 图生视频 / vlab） | `3001` | `tool.ai-code8.com` |
| `finance-web` | 财务控制台（用户账单详情 / 管理员账单管理） | `3002` | `f.ai-code8.com` |

> 三个工程相互通过 HTTPS 跨域调用；浏览器 Cookie 走主站签发，财务控制台与工具站通过 CORS（`lib/finance/cors.ts`）放行已配置的 `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` 与 `TOOLS_PUBLIC_ORIGIN`。

---

## 1. 本机开发

```bash
# 主站
cd book-mall && pnpm install && pnpm dev          # http://localhost:3000

# 工具站
cd tool-web && pnpm install && pnpm dev           # http://localhost:3001

# 财务控制台
cd finance-web && pnpm install && pnpm dev        # http://localhost:3002
```

各工程对应的 `.env.example` / `.env.development` 描述必填项；最重要的：

- `book-mall/.env.local`：`DATABASE_URL`、`NEXTAUTH_URL=http://localhost:3000`、`TOOLS_PUBLIC_ORIGIN=http://localhost:3001`、`NEXT_PUBLIC_FINANCE_WEB_ORIGIN=http://localhost:3002`、`TOOLS_SSO_*` 双方一致、`SSO_TOOLS_BEARER_TOKEN`。
- `tool-web/.env.local`：`MAIN_SITE_ORIGIN=http://localhost:3000`、`TOOLS_SSO_*` 与主站对齐、阿里云 DashScope / OSS 凭据。
- `finance-web/.env.local`：`BOOK_MALL_BILLING_INTERNAL_ORIGIN=http://localhost:3000`（服务端代理目标）。

数据库初始化：

```bash
cd book-mall
pnpm db:apply-pending          # 应用任何未跑的迁移（绕过 Prisma CLI 的 P1001 路径）
pnpm prisma generate
pnpm pricing:import-markdown   # 从 tool-web/doc/price.md 导入价目源
```

---

## 2. 生产：腾讯云 CloudBase Run（容器托管）

三个工程都有 `Dockerfile` + `docker-entrypoint.sh`，可独立构建为容器镜像并部署。

### 2.1 构建

CloudBase 控制台的「云托管 / 容器服务」绑定本仓库的 GitHub/腾讯工蜂分支后，**为每个服务**指定子目录与 Dockerfile：

| 服务 | 构建目录 | 启动端口 | 自动构建 |
|------|---------|---------|---------|
| `book-mall` | `book-mall/` | `3000` | 推送 `main` 即触发 |
| `tool-web` | `tool-web/` | `3000` | 推送 `main` 即触发 |
| `finance-web` | `finance-web/` | `3000` | 推送 `main` 即触发 |

> 三个 `Dockerfile` 都使用多阶段构建，runner 阶段以 `node:20-bookworm-slim` + Next.js standalone 启动；`book-mall` 在 entrypoint 中执行 `prisma migrate deploy`，因此**第一次部署**必须保证 `DATABASE_URL` 已经在云托管「环境变量」面板配置。

### 2.2 自定义域名 / TLS

在云托管「访问设置」绑定域名（须先在 DNSPod 解析到云托管 CNAME），TLS 由腾讯云自动签发：

| 服务 | 自定义域 |
|------|---------|
| book-mall | `book.ai-code8.com` |
| tool-web | `tool.ai-code8.com` |
| finance-web | `f.ai-code8.com` |

### 2.3 必填环境变量

参考 [`.env.example`](book-mall/.env.example) / [`tool-web/.env.example`](tool-web/.env.example) / [`finance-web/.env.example`](finance-web/.env.example)。三方都必填且互相一致的关键项：

- `book-mall`
  - `DATABASE_URL`（腾讯云 PostgreSQL 直连 URL；逻辑库 `tool_mall`）
  - `NEXTAUTH_SECRET`、`NEXTAUTH_URL=https://book.ai-code8.com`
  - `TOOLS_PUBLIC_ORIGIN=https://tool.ai-code8.com`、`TOOLS_SSO_JWT_SECRET`、`TOOLS_SSO_SERVER_SECRET`
  - `SSO_TOOLS_BEARER_TOKEN`（财务控制台到主站的 server-to-server）
  - `NEXT_PUBLIC_FINANCE_WEB_ORIGIN=https://f.ai-code8.com`
  - DashScope / OSS / SMS 等业务凭据
- `tool-web`
  - `MAIN_SITE_ORIGIN=https://book.ai-code8.com`
  - 同主站一致的 `TOOLS_SSO_JWT_SECRET / TOOLS_SSO_SERVER_SECRET`
  - DashScope key、OSS 凭据
- `finance-web`
  - `BOOK_MALL_BILLING_INTERNAL_ORIGIN=https://book.ai-code8.com`（服务端代理调用主站 API）
  - `BOOK_MALL_BILLING_BEARER`（≡ `book-mall/SSO_TOOLS_BEARER_TOKEN`）

> `book-mall/docker-entrypoint.sh` 会在 `NODE_ENV=production` 且未设置 `ALLOW_CLOUDBASE_DEFAULT_ORIGINS=1` 的情况下，把空 `NEXTAUTH_URL / TOOLS_PUBLIC_ORIGIN` 自动纠正为正式域；想保留云托管 `*.sh.run.tcloudbase.com` 默认域临时调试请设 `ALLOW_CLOUDBASE_DEFAULT_ORIGINS=1`。
> `finance-web/docker-entrypoint.sh` 同样会把空 `BOOK_MALL_BILLING_INTERNAL_ORIGIN` 纠正为 `https://book.ai-code8.com`。

### 2.4 首次部署流程

```text
1) DNSPod 解析 *.ai-code8.com → 云托管 CNAME
2) 云托管控制台为三个服务分别绑定本仓库的同一分支（一般 main）
3) 为每个服务在「环境变量」面板贴上 .env.example 列出的全部生产值
4) 触发首次构建：book-mall 自动跑 prisma migrate deploy；tool-web/finance-web 直接起服务
5) 等三个服务都 RUNNING；浏览器打开 book.ai-code8.com 验证登录 → 工具站 SSO → 财务控制台
```

### 2.5 后续重发

```text
- 代码改完直接推 main → 云托管收到 webhook 后自动构建并平滑替换实例
- 涉及数据库 schema：写迁移 → push → book-mall 的 entrypoint 自动 prisma migrate deploy
- 涉及 .env 变量：在云托管「环境变量」面板改完后手动触发一次「重启服务」即可
```

---

## 3. v002 财务模块涉及的脚本（部署后/迁移后常用）

> 全部在 `book-mall/` 目录执行；使用 `.env.local` 或在 shell 中导出 `DATABASE_URL` 后用 `dotenv -e` 自带的方式跑。

```bash
# 数据库
pnpm db:apply-pending                       # 应用未跑迁移（CLI P1001 退路）
pnpm prisma generate

# 价目与定价
pnpm pricing:import-markdown                # 从 tool-web/doc/price.md 导入 → PricingSourceVersion + Lines
pnpm pricing:verify-billable-formula        # pricePoints = round(cost × M × 100) 自洽校验
pnpm pricing:audit-billable-vs-source       # 把 stored cost vs PricingSourceLine 摆成对照表（供运营手核）

# 历史数据维护
pnpm billing:backfill-tool-usage-lines      # 从 ToolUsageEvent 反向生成 ToolBillingDetailLine
pnpm billing:refresh-tool-usage-snapshot    # 用当前 ToolBillablePrice 重填 internal* 列
pnpm billing:backfill-internal-pricing      # CLOUD_CSV_IMPORT 行从 cloudRow 反推 internal*
pnpm billing:backfill-schemea-unit-cost     # 反推 ToolBillablePrice.schemeAUnitCostYuan（一次性）

# 对账（管理端 UI：/admin/finance/reconciliation）
pnpm reconciliation:run -- --csv=./path/to/aliyun.csv [--admin-user-id=cmp...]
```

---

## 4. 服务相互调用拓扑（仅供运维参考）

```
浏览器
 ├─ https://book.ai-code8.com   (book-mall)            → PostgreSQL (tool_mall)
 │        │
 │        ├─ /api/sso/tools/code → /api/sso/tools/usage  → ToolBillingDetailLine
 │        ├─ /api/admin/finance/reconciliation/{run,bind,[id]/clawback}
 │        └─ /api/admin/finance/billing-detail-lines  (财务控制台拉的明细)
 │
 ├─ https://tool.ai-code8.com   (tool-web)
 │        │
 │        └─ /api/{ai-fit,text-to-image,image-to-video,visual-lab}/...
 │             └─ postToolUsageFromServerWithRetries → book-mall /api/sso/tools/usage
 │
 └─ https://f.ai-code8.com      (finance-web)
          │
          └─ /api/account/billing-detail-lines (proxy)
              ├─ /api/account/billing-detail-lines    →  book-mall
              ├─ /api/admin/billing-detail-lines      →  book-mall
              └─ /api/sso/tools/billing-detail-lines  →  book-mall
```

---

## 5. 故障速查

- **Prisma CLI P1001（数据库连不上）**：通常是 DNS / 出口安全组；先用 `pnpm db:apply-pending` 走纯 SQL 应用迁移（在 `scripts/apply-pending-migrations.ts` 里）。
- **"Failed to fetch" / CORS**：finance-web 应通过 `/api/.../*` server proxy 调主站，不要直接 fetch 主站 origin；检查 `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` 是否与 `lib/finance/cors.ts` 一致。
- **工具站 402 余额不足**：响应里附 `watermarkPoints + gate`；用户应充值后重试（水位线见 v002 文档 P2-3）。
- **对账 0 行**：检查 `ToolBillingDetailLine.cloudRow.账单信息/账单月份` 是否为 `YYYYMM`（不是 `YYYY-MM`）；脚本 `billing-refresh-tool-usage-snapshot` 已经把日期格式归一化。
