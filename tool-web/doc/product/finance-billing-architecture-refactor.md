# 财务计费架构重构说明（book-mall · finance-web · tool-web）

> **⚠️ 实施以 [v002 定案版](../reconciliation-baseline-2026-05-16-v002.md) 为准**——本文是骨架与术语说明；具体路线图（P0~P4）、价目核对、对账与水位线策略统一在 v002。  
> 本文记录一次重要重构：**云级账单明细以主站（book-mall）为唯一数据源**，财务控制台与工具站仅通过 **HTTP API** 消费数据；**移除**主站「财务核对」CSV 导出、finance-web 的 **本地 CSV 回退**。供后续排查、接入与培训备查。

---

## 1. 目标与原则

| 原则 | 说明 |
|------|------|
| 单一数据源 | 财务控制台显示的数据 **只来自** `ToolBillingDetailLine`，按 `source` 区分两类来源（详见 §1.1）。 |
| 不直连数据库 | **finance-web**、**tool-web** 均 **不得** 连接 book-mall 的 PostgreSQL；只调 book-mall 已发布的 Route Handler。 |
| 鉴权分层 | 浏览器用户端用 **NextAuth Cookie**；工具站服务端代理用 **工具 JWT（`Authorization: Bearer`**，与 `/api/sso/tools/usage` 同源校验）。 |
| 无静默演示数据 | finance-web 在 API 失败或缺配置时 **不再** 用仓库内 CSV 兜底，避免与真实账本混淆。 |
| 对内计价快照入库 | `ToolBillingDetailLine` 上 **`internalCloudCostUnitYuan`** 等列 + **`internalFormulaText`** + **`internalCapturedAt`**：写入时即固化；读接口 **优先用库内值**，未固化的历史行才临时用 `pricingTemplateKey` 模板兜底。 |

### 1.1 两类数据来源（`ToolBillingDetailLine.source`）

| `source` | 触发时机 | `pricingTemplateKey` | 写入位置 |
|----------|----------|---------------------|----------|
| **`TOOL_USAGE_GENERATED`**（**主**：用户在工具站的实际扣点流水） | 用户成功调用工具，主站 `recordToolUsageAndConsumeWallet` 同事务写入 | `internal.tool_usage_v1` | `book-mall/lib/wallet-record-tool-usage-consume.ts` |
| **`CLOUD_CSV_IMPORT`**（**对账参考**：云厂商账单原始行） | 手动 `pnpm billing:import-cloud-csv` 把 `consumedetailbillv2.csv` 等导入 | 默认 `aliyun.consumedetail_bill_v2`（可由 `BILLING_IMPORT_PRICING_TEMPLATE` 覆盖） | `book-mall/scripts/billing-import-cloud-csv.ts` |

**关键约定**：

- 财务控制台从用户进入起，**直接展示其自身的工具站扣点流水**（`TOOL_USAGE_GENERATED`）；该路径不依赖任何 CSV 导入。
- `tool-web/doc/price*.md`、`*.consumedetailbillv2.csv` 等仅是 **云侧实际费用结果**，作为后续对账参照，不参与日常显示。
- 两类行 **共表共列**：`cloudRow` 都按 `lib/finance/bill-display-keys.ts` 的中文展示 key 组织；`TOOL_USAGE_GENERATED` 的 `cloudRow` 由 `lib/finance/tool-usage-billing-line.ts` 合成（工具名、计费项、扣点等），云 CSV 行直接保存原文。
- 「平台信息/计价模板」一列即标记来源：**工具站使用 · 点数直扣** vs **阿里云 · consumedetailbill_v2**。

---

## 2. 架构简图

```text
┌─────────────────┐     CORS + Cookie      ┌──────────────────────────────┐
│  finance-web    │ ──────────────────────►│ book-mall                    │
│  (财务控制台)    │   /api/account/…        │  ToolBillingDetailLine       │
│                 │   /api/admin/finance/…  │  Wallet + NextAuth           │
└─────────────────┘                         └──────────────┬───────────────┘
                                                           │
┌─────────────────┐   MAIN_SITE_ORIGIN + Bearer tools_token
│  tool-web       │   /api/sso/tools/billing-detail-lines
│  (工具站)       │ ◄──────────────────────────────────────┘
│  /api/tool-*    │   （由 tool-web 的 route 代理，带 Cookie 换 JWT）
└─────────────────┘
```

---

## 3. book-mall：接口与职责

### 3.1 用户端（含 finance-web 跨域）

| 方法与路径 | 作用 | 鉴权 |
|------------|------|------|
| `GET /api/account/billing-detail-lines` | 当前登录用户的云级明细 + 余额 | `getServerSession`；开发可选 `FINANCE_ALLOW_DEV_USER_QUERY=1` + `?devUserId=`（非 production） |
| `OPTIONS` 同上 | CORS 预检 | `lib/finance/cors.ts`：`FINANCE_WEB_ORIGINS` |

响应体（语义一致处与下节相同）：`source`、`user`、`balancePoints`、`rows`（已 fatten 的平铺列，含对内计价字段）。

### 3.2 管理端

| 方法与路径 | 作用 | 鉴权 |
|------------|------|------|
| `GET /api/admin/finance/billing-detail-lines?userId=` | 指定用户的明细 + 余额 | 管理员 `session.user.role === "ADMIN"` |

### 3.3 工具站 SSO（服务端对接）

| 方法与路径 | 作用 | 鉴权 |
|------------|------|------|
| `GET /api/sso/tools/billing-detail-lines` | 与 **账号侧用户明细同形 JSON**（JWT `sub` = 平台 `userId`） | `lib/sso-tools-bearer.ts`：`requireToolsJwtSecret` + `verifyToolsAccessToken` |

**实现说明**：与 `GET /api/sso/tools/usage` 共用同一套 Bearer 校验逻辑（已从 usage 路由抽至 `verifyToolsBearer`）。

### 3.4 已移除（旧财务）

- 页面：`/admin/finance/reconciliation`
- 接口：`/api/admin/finance/reconciliation-export`

充值实收/赠送、GMV 口径等仍以钱包与订单为准；云级行以 **`ToolBillingDetailLine` + 导入脚本** 为准，不再依赖上述导出 CSV。

### 3.5 个人中心与管理后台入口（主站）

**个人中心 `/account`**（「费用与明细」区块）

- **工具站 · 费用使用明细**：`{TOOLS_PUBLIC_ORIGIN}/app-history`（外链，新标签打开）。
- **财务控制台 · 账单详情**：需配置 **`NEXT_PUBLIC_FINANCE_WEB_ORIGIN`**（与 tool-web / finance-web 一致）。

**管理后台 `/admin`**

- 概览页顶部与「前台价格公示」并列：**财务控制台 · 账单详情**、**财务控制台 · 管理端**（新标签打开）。
- 顶栏 **计费与资金** 下拉底部：**财务控制台 · 账单详情**、**财务控制台 · 管理端**（未配置 `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` 时该项为灰色不可用提示）。

### 3.6 工具站扣点 → 明细行（**主路径**）

工具站每次成功调用经 `POST /api/sso/tools/usage`，主站 `recordToolUsageAndConsumeWallet` 在同一事务里：

1. 扣减 `Wallet.balancePoints`；
2. 写 `ToolUsageEvent`；
3. 写 `WalletEntry`；
4. **新增**：写 `ToolBillingDetailLine`（`source = TOOL_USAGE_GENERATED`，`pricingTemplateKey = internal.tool_usage_v1`），`cloudRow` 由 `lib/finance/tool-usage-billing-line.ts` 合成；`internalChargedPoints`/`internalYuanReference` 当时固化。

历史回填（首次接入或新库导入旧数据后）：

```bash
cd book-mall
# 全量
pnpm billing:backfill-tool-usage-lines
# 指定用户
BILLING_BACKFILL_USER_ID=<User.id> pnpm billing:backfill-tool-usage-lines
```

幂等：脚本会按 `toolUsageEventId` 跳过已存在的行；可重复执行。仅处理 `costPoints > 0` 的事件（`page_view` 等忽略）。

### 3.7 云 CSV 入库（对账用，可选）

```bash
cd book-mall
BILLING_IMPORT_USER_ID=<User.id> BILLING_IMPORT_REPLACE=1 pnpm billing:import-cloud-csv
# 可选：覆盖计价模板（不同云厂商）
BILLING_IMPORT_PRICING_TEMPLATE=aliyun.consumedetail_bill_v2 pnpm billing:import-cloud-csv
```

脚本与 `csv-parse` 依赖见 `book-mall/scripts/billing-import-cloud-csv.ts`。迁移未执行见环境就绪后 `pnpm db:deploy` / `pnpm db:apply-pending`（CLI 不可用时的应急通道，见 `book-mall/doc/tech/tencent-postgresql.md` 故障档案）。

---

## 4. finance-web：行为与配置

- **读数**：仅通过 `NEXT_PUBLIC_BOOK_MALL_URL` 请求 3.1 / 3.2 对应路径；**无本地 `data/*.csv`、无 `load-bill`、无 csv-parse**。
- **开发兜底**：可在 book-mall 开启 `FINANCE_ALLOW_DEV_USER_QUERY`，finance-web 配置 `NEXT_PUBLIC_FINANCE_DEV_USER_ID` _QUERY 传 `devUserId`（**仅非 production**）。
- **端口**：默认 `next dev -p 3002`；详情见 `finance-web/README.md`。

---

## 5. tool-web：代理、环境与 UI

### 5.1 服务端代理

| 路径 | 上游 |
|------|------|
| `GET /api/tool-billing-detail-lines` | `{MAIN_SITE_ORIGIN}/api/sso/tools/billing-detail-lines` |

需有效工具会话（`tools_token` Cookie）与 **`requireActiveToolsSession`** 通过，与 ` /api/tool-usage` 一致。

### 5.2 环境变量（节选）

| 变量 | 用途 |
|------|------|
| `MAIN_SITE_ORIGIN` | 请求主站 SSO 与钱包等（已有） |
| `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` | 浏览器打开 **财务控制台** 外链（如 `http://localhost:3002`）；**未配置则「费用使用明细」内不展示该外链块** |

示例见 `tool-web/.env.example`、`tool-web/config/tool-web.env.example`。

### 5.3 用户可见入口

- **费用使用明细**（`/app-history`）：配置财务 Origin 后，说明 **云级明细**、财务控制台链接、以及 `GET /api/tool-billing-detail-lines` 的 JSON 用途。
- **价格表**（`/app-history/price-list`）：脚注链到规则、费用明细与财务控制台配置说明。

**区分**：本页「使用明细」仍以 **`ToolUsageEvent` 按次扣费** 为主；云 CSV 颗粒度行为见 **`ToolBillingDetailLine`** 与 finance-web 表。

---

## 6. 环境变量总表（联调速查）

| 应用 | 变量 | 说明 |
|------|------|------|
| book-mall | `FINANCE_WEB_ORIGINS` | 允许 finance-web 的 Origin，逗号分隔 |
| book-mall | `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` | 个人中心「账单详情」外链；与 finance-web 根 URL 一致 |
| book-mall | `FINANCE_ALLOW_DEV_USER_QUERY` | `1` 时非 production 允许 `?devUserId=` |
| book-mall | `TOOLS_*_JWT` / SSO | 与 tool-web `TOOLS_SSO_*` 一致（既有） |
| finance-web | `NEXT_PUBLIC_BOOK_MALL_URL` | 主站根 URL |
| finance-web | `NEXT_PUBLIC_FINANCE_DEV_USER_ID` | 可选，开发看指定用户明细 |
| tool-web | `MAIN_SITE_ORIGIN` | 主站根 URL |
| tool-web | `NEXT_PUBLIC_FINANCE_WEB_ORIGIN` | 财务控制台外链 |

---

## 7. 相关文档索引

| 文档 | 内容 |
|------|------|
| `finance-web/README.md` | 控制台用途、端口、与 book-mall 联调 |
| `tool-web/doc/reconciliation-baseline-2026-05-16.md` | 对帐口径、价目与 **consumedetailbillv2** 列语义（注意：其中若仍写「finance-web CSV 回退」应以 **本文为准**，该回退已删除） |
| `book-mall/doc/product/points-wallet-topup-spec.md` | 充值、实收/赠送与云级明细引用条目的更新说明 |

---

## 8. 变更摘要（供 Code Review / 发布说明）

1. 新增 `book-mall/lib/sso-tools-bearer.ts`、`GET /api/sso/tools/billing-detail-lines`；`usage` 路由复用 Bearer 校验。  
2. 新增 `tool-web/app/api/tool-billing-detail-lines/route.ts`；费用页、价格表脚注与 env 示例更新。  
3. 删除主站财务核对页与导出 API；finance-web 删除 CSV 演示链路与依赖。  
4. 约定：**所有财务明细展示与工具侧 JSON 拉取** 以 book-mall API 为唯一入口。  
5. 主站 **`/account`** 提供费用外链（工具站流水 + 财务控制台账单详情，见 §3.5）。  
6. **对内计价**：`ToolBillingDetailLine` 持久化云成本单价、系数、我方单价、公式全文、扣点、折元及 **`internalCapturedAt`**；迁移 `20260528130000_tool_billing_line_internal_pricing_snapshot`；回填命令 **`pnpm billing:backfill-internal-pricing`**（仅作用于 CLOUD_CSV_IMPORT）。  
7. **计价模板**：`pricingTemplateKey`（迁移 `20260528150000_tool_billing_line_pricing_template_key`）+ `lib/finance/pricing-templates/*` 注册表；默认 `aliyun.consumedetail_bill_v2`；新云厂商新增模板文件并在 `registry.ts` 注册；导入可选 **`BILLING_IMPORT_PRICING_TEMPLATE`**。  
8. **（0516）工具扣点 → 明细行**：新增 `lib/finance/tool-usage-billing-line.ts` 与 `internal.tool_usage_v1` 模板；`recordToolUsageAndConsumeWallet` 同事务写 `ToolBillingDetailLine`（`source = TOOL_USAGE_GENERATED`）。**这是财务控制台显示用户实际扣点流水的主路径**，先于 / 独立于 CSV 导入。  
9. **历史回填**：`scripts/billing-backfill-tool-usage-lines.ts` 与 `pnpm billing:backfill-tool-usage-lines`（可按 `BILLING_BACKFILL_USER_ID` 限定用户），用于把库内已存在的 `ToolUsageEvent` 投影为明细行。  
10. **迁移应急通道**：`scripts/apply-pending-migrations.ts` 与 `pnpm db:apply-pending`，用于 Prisma CLI 出现 P1001（schema engine 网络栈问题）但 PrismaClient 可连库的场景，详见 `book-mall/doc/tech/tencent-postgresql.md` 故障档案。

---

*文档版本：与仓库当前实现同步；若接口或 env 有变，请在本文件与 `finance-web/README.md` 一并更新。*
