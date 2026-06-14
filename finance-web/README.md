# finance-web

finance-web：表头与 **`consumedetailbillv2`** 对齐，并带 **对内计价** 列。产品说明见 `tool-web/doc/reconciliation-baseline-2026-05-16.md` §8.6。**整体架构与三端接口**见 [`tool-web/doc/product/finance-billing-architecture-refactor.md`](../tool-web/doc/product/finance-billing-architecture-refactor.md)。

## 「ToolBillingDetailLine + 登录用户」指什么？

- **`ToolBillingDetailLine`** 是 book-mall 里的一张表：每一行 = 云账单的一行粒度，完整列放在 JSON **`cloudRow`**，并带有 **`userId`**（**你们平台上的用户**，不是阿里云主账号那一列）。
- **登录用户**：`GET /api/account/billing-detail-lines` 用 NextAuth **`session.user.id`**，只返回 **当前登录会员** 的行，并带上 **钱包 `balancePoints`**。这样 finance-web 展示的是「**这个人**在平台上的明细与余额」，而不是整张混在一起的云 CSV。
- **finance-web** 仅从 **book-mall HTTP API** 读数（`GET /api/account/billing-detail-lines` 与（需管理员）`GET /api/admin/finance/billing-detail-lines`），**不直连数据库**，也不再用仓库内 CSV 兜底。
- **工具站**：已登录工具会话时可通过 `GET /api/tool-billing-detail-lines`（tool-web 代理 `GET /api/sso/tools/billing-detail-lines`）取与本页同形 JSON。

## 开发与端口

```bash
cd finance-web
pnpm install
pnpm run dev
# http://localhost:3002 → 「费用 → 账单详情」
```

配置示例见 `.env.example`。

**本地零配置**：根目录 `pnpm dev:all` 后，finance-web 默认主站 `http://localhost:3000`，API 经同源 `/api/book-mall/*` 代理转发登录 Cookie，**不必**在 book-mall 配 `FINANCE_WEB_ORIGINS`，也**不必**创建 `finance-web/.env.local`（除非要改端口或走 dev 模拟用户）。

> ⚠️ **不要默认开** `NEXT_PUBLIC_FINANCE_USE_DEV_PROXY=1`、`FINANCE_DEV_USER_ID=...`（固定 User.id 模拟，与真实登录无关）。仅调试时在 URL 带 `?useProxy=1` / `?asDev=1`。

## 与 book-mall 联调

1. 数据库连通后，在 `book-mall` 执行迁移（含 `20260516180000_tool_billing_detail_line`）：`pnpm db:deploy` 或 `pnpm db:migrate`。  
2. 将云 CSV 导入某用户：

   ```bash
   cd book-mall
   BILLING_IMPORT_USER_ID=<User.id> BILLING_IMPORT_REPLACE=1 pnpm billing:import-cloud-csv
   ```

3. **使用真实账号**：同浏览器打开 `http://localhost:3000/login` 登录后访问 `http://localhost:3002/fees/billing/details` 或 `/team` 即可（请求经 BFF 代理，无需 book-mall CORS 配置）。

## 财务 2.0 · 三角色入口（:3002）

| 入口 | 路径 | 角色 |
|------|------|------|
| **个人** | `/fees/billing/details`、`/fees/usage` | 所有登录用户 |
| **团队** | `/team/billing` | 团队 OWNER/ADMIN 可见明细；成员见提示 |
| **系统管理** | `/admin/*` | 平台员工（运营/财务/超管/legacy ADMIN） |

财务 2.0 核心能力（盈亏预警、调价审批、双池用量、团队分账）在 **finance-web** 展示；数据与规则仍在 **book-mall** API（Single Writer）。

## 页面

- **费用明细（本人）**：`/fees/billing/details`  
- **`/admin` 区**：`/admin`、`/admin/billing/users/<User.id>`（需管理员已在 book-mall 登录）、`/admin/models/coefficients`

## 构建

```bash
pnpm run build && pnpm start
```

## 腾讯云 CloudBase 部署

与 `tool-web` 相同：代码在 **`priceLiu/book-mall`** 仓库的 **`finance-web/`** 子目录；云托管 **Git 仓库选 `priceLiu/book-mall`**，**目标目录填 `finance-web`**（不需要新建独立 Git 仓库）。

逐步说明见 [`deploy/tencent/README.md`](../deploy/tencent/README.md)、[`deploy/tencent/finance-web.env.example`](../deploy/tencent/finance-web.env.example)。
