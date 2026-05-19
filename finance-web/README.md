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
npm install
npm run dev
# http://localhost:3002 → 「费用 → 账单详情」
```

配置示例见 `.env.example`。**默认浏览器直连 book-mall**，使用主站真实 NextAuth 会话拉账单（localhost:3002↔3000 同站点，SameSite=Lax 的 session Cookie 会被发送）。

> ⚠️ **不要默认开** `NEXT_PUBLIC_FINANCE_USE_DEV_PROXY=1`、`NEXT_PUBLIC_FINANCE_DEV_USER_ID=...`。一旦开启，账单接口将以**固定的 dev User.id** 替你拉数据，**与你浏览器实际登录的账号无关**——会出现「登录 A 却看到 B 的明细」。这两个开关现在仅在 URL 显式带 `?useProxy=1` / `?asDev=1` 时生效，并在页面顶部以红色阻断框警示。

## 与 book-mall 联调

1. 数据库连通后，在 `book-mall` 执行迁移（含 `20260516180000_tool_billing_detail_line`）：`pnpm db:deploy` 或 `pnpm db:migrate`。  
2. 将云 CSV 导入某用户：

   ```bash
   cd book-mall
   BILLING_IMPORT_USER_ID=<User.id> BILLING_IMPORT_REPLACE=1 pnpm billing:import-cloud-csv
   ```

3. book-mall `.env.local` 必填（本地）：`FINANCE_WEB_ORIGINS=http://localhost:3002`（CORS）。  
   仅在「故意以某个 User.id 模拟」场景下临时把 `FINANCE_ALLOW_DEV_USER_QUERY=1` 打开，并在 finance-web 页面 URL 上带 `?asDev=1`（或 `?useProxy=1`）。  
4. **使用真实账号**：在同浏览器打开 `http://localhost:3000/login` 登录后回到 `http://localhost:3002/fees/billing/details` 刷新即可。顶部「当前账单归属」应显示你的邮箱与 `authMode = session`。

## 页面

- **费用明细（本人）**：`/fees/billing/details`  
- **`/admin` 区**：`/admin`、`/admin/billing/users/<User.id>`（需管理员已在 book-mall 登录）、`/admin/models/coefficients`

## 构建

```bash
npm run build && npm start
```
