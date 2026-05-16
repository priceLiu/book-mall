# 0516 财务重大重构（总文档 / Source of Truth）

> 与 v001 / v002 实施记录配套：
> - 设计与价目核对：[`tool-web/doc/reconciliation-baseline-2026-05-16.md`](../../../tool-web/doc/reconciliation-baseline-2026-05-16.md)（v001）
> - v002 实施记录：[`tool-web/doc/reconciliation-baseline-2026-05-16-v002.md`](../../../tool-web/doc/reconciliation-baseline-2026-05-16-v002.md)
> - 架构愿景：[`tool-web/doc/product/finance-billing-architecture-refactor.md`](../../../tool-web/doc/product/finance-billing-architecture-refactor.md)
> - 部署指南：[`DEPLOY.md`](../../../DEPLOY.md)
>
> 本文档记录 2026-05-16 ~ 2026-05-16 内完成的一次**财务模块重大重构**的全部代码与产品决策；以后做任何改动都先回这里对齐。

---

## 1. 业务定位（重述）

我们是「云厂商代理」——在阿里云 / 腾讯云 DashScope 等模型 API 之上做工具站包装，按 `cost × 系数` 卖给用户。

定价口径：

```
内部计价 = ToolBillablePrice 行
  schemeAUnitCostYuan         # 云厂商「采购成本」（元/次/张/秒，由 PricingSourceLine 推导或人工填）
  schemeAAdminRetailMultiplier # 销售系数 M（默认 2）
  schemeARefModelKey           # 对应 price.md 中的模型 key
  pricePoints = round(cost × M × 100)  # 100 点 = 1 元

记账：
  recordToolUsageAndConsumeWallet(snap) → ToolUsageEvent (用户视角)
                                        → ToolBillingDetailLine (财务视角，TOOL_USAGE_GENERATED)
                                        → Wallet.balancePoints -= snap.points
```

对账：

```
管理员上传阿里云 consumedetailbillv2 CSV
  → 按 「身份信息/资源购买账号ID」 经 CloudAccountBinding 映射到平台 user
  → 每行写入 ToolBillingDetailLine (CLOUD_CSV_IMPORT)
  → 按 (user, modelKey, billingKind) 汇总 内部计价 vs 云应付
  → 写 BillingReconciliationRun + Lines
  → diff < 0 的用户行可二次确认后一键 clawback（写 WalletEntry 幂等）
```

---

## 2. 数据模型（最终态）

### 2.1 新增 / 扩充

| 表 | 字段（关键） | 说明 |
|----|-------------|------|
| `ToolBillablePrice` | `+ cloudModelKey / cloudTierRaw / cloudBillingKind` | 把云厂商账单的 `产品信息/规格 / 用量信息/用量单位` 拉到列上，便于查找匹配 |
| `ToolBillingDetailLine` | （v001 已加 internal* 列）继续填充 | 内部计价快照入库；新增字段在 v001 阶段已落 |
| `PricingSourceLine` | `+ effectiveDiscount / effectivePromoNote / effectiveCapturedAt` | 留位给后续解析阿里 0.8 折等促销 |
| `CloudAccountBinding` | `cloudAccountId UNIQUE, userId, cloudAccountName, note` | 「资源购买账号 ID」 ↔ 平台 User 绑定 |
| `BillingReconciliationRun` | `csvSha256 UNIQUE, csvFilename, monthsCovered, importedByUserId, summary JSON, status` | 一次「上传 CSV → 对账」批次 |
| `BillingReconciliationLine` | `runId, userId, cloudAccountId, modelKey, billingKind, internalCount/Yuan, cloudCount/Yuan, diffYuan, matchKind, clawback*` | 一批次内单用户 × 单(模型/计费维度) 一行；带 clawback 字段 |

迁移文件：

- `prisma/migrations/20260516180000_tool_billing_detail_line/`
- `prisma/migrations/20260528130000_tool_billing_line_internal_pricing_snapshot/`
- `prisma/migrations/20260528150000_tool_billing_line_pricing_template_key/`
- `prisma/migrations/20260629120000_v002_billable_cloud_link_and_effective/`
- `prisma/migrations/20260630120000_v002_p5_reconciliation_tables/`

所有迁移走 `pnpm db:apply-pending`（自研脚本，绕过 Prisma CLI 的 P1001 错误）。

### 2.2 删除 / 废弃

| 旧路径 | 替换为 |
|--------|-------|
| `app/admin/finance/reconciliation/page.tsx`（v001 老 UI） | 同路径，v002 重写为多步「上传 → 报告 → 补扣」 |
| `app/api/admin/finance/reconciliation-export/route.ts` | 删除（由 `BillingReconciliationRun.lines` 替代） |
| `scripts/reconcile-against-cloud-csv.ts` | 删除（lib `runReconciliationFromCsv`） |
| `scripts/billing-deficit-claw-back.ts` | 删除（API `/api/admin/finance/reconciliation/[runId]/clawback`） |
| `scripts/billing-import-cloud-csv.ts` | 删除（由 `pnpm reconciliation:run` 走同一 lib） |
| `POST /api/sso/tools/usage` 的 `body.costPoints` 参数 | **移除**：定价完全由服务端 `ToolBillablePrice` 决定（v002 安全加固） |

---

## 3. 五阶段实施（v002 P0–P5）

| 阶段 | 工件 |
|------|------|
| P0 内部计价快照入库 | `lib/finance/pricing-templates/internal-tool-usage-v1.ts`、`lib/tool-billable-price.ts`（`resolveBillableSnapshot`）、`lib/wallet-record-tool-usage-consume.ts`、`scripts/billing-refresh-tool-usage-snapshot.ts`、UI 角色隔离（`finance-web/lib/bill-config.ts:filterColumnGroupsByRole`） |
| P1 schema 增强 | `prisma/schema.prisma` 加 cloud* 字段；server action `app/actions/tool-apps-admin.ts` 强制 `points = max(1, round(cost × M × 100))`，`cost=0` 拒绝 |
| P2 公式模板 + 水位线 | `lib/finance/pricing-templates/internal-tool-usage-formula.ts` (3 模板：token / seconds / image)；事务首部水位线门禁（402 返回 `watermarkPoints + gate`） |
| P3 对账与漂移检测 | `scripts/pricing-verify-billable-formula.ts`（自洽 + 漂移）、`scripts/pricing-audit-billable-vs-source.ts`（人工对照 price.md 报告） |
| P4 多云骨架 | `lib/finance/pricing-templates/tencent-bill-v1.ts`（占位 compute；接腾讯云时按 aliyun 模式补） |
| **P5 对账 UI** | 三表 + 三 API + 一管理端页面 + nav 入口 |

P5 详情：

```
DB:    CloudAccountBinding · BillingReconciliationRun · BillingReconciliationLine
API:   POST /api/admin/finance/reconciliation/run        # 上传 CSV
       POST /api/admin/finance/reconciliation/bind       # 绑定云账号→用户
       POST /api/admin/finance/reconciliation/[runId]/clawback  # 二次确认补扣
       GET  /api/admin/finance/reconciliation/bind       # 列绑定（管理界面用）
UI:    /admin/finance/reconciliation                     # 上传 / 报告 / 补扣（两次 window.confirm）
       /admin/finance/usage-overview                     # 多维度费用聚合（月/工具/模型/用户）
       /admin/finance/pricing-templates                  # 计费模板与公式可视化
       /admin/finance/cloud-pricing                      # 云厂商价目表索引
       /admin/finance/cloud-pricing/[versionId]          # 单版本所有 PricingSourceLine（带筛选）
       /account/pricing                                  # 用户端我方价目表（不暴露 cost/系数）
```

---

## 4. 已就绪 / 待运营操作的事项

### 已就绪

- ✅ 31 行 `ToolBillablePrice.schemeAUnitCostYuan` 已由 `pnpm billing:backfill-schemea-unit-cost` 反推填齐；运营可在「定价管理」按 `price.md` 实际价微调。
- ✅ `pnpm pricing:verify-billable-formula` exit 0（公式自洽，drift=0）。
- ✅ `pnpm pricing:audit-billable-vs-source` exit 0（已正确分类「源单价缺失 / 单位不可比」的行，不再误报漂移）。
- ✅ `POST /api/sso/tools/usage` 不再接受 `body.costPoints`；4 个 settle 路由（ai-fit / text-to-image / image-to-video / visual-lab）已切到「只发 toolKey + action + meta.modelId」。
- ✅ 管理端「计费与资金」菜单已加入 4 个新入口：费用概览 / 对账 / 计费模板 / 云价目。
- ✅ 个人中心「费用与明细」加入「我方价目表」入口。
- ✅ 三个工程都有 `Dockerfile` + `docker-entrypoint.sh`；`finance-web` 新增；统一部署指南 `DEPLOY.md`。

### 待运营操作

- ⏳ 在「定价管理」对照 `tool-web/doc/price.md` / `price_0518.md` 校正每个 `ToolBillablePrice` 的 cost（必要时刷新 multiplier）。建议运营每月跑一次：
  ```bash
  pnpm pricing:import-markdown          # 拉最新价目
  pnpm pricing:audit-billable-vs-source # 看 stored vs source 对照
  ```
- ⏳ 收到云厂商月账单 CSV 后，登录 `/admin/finance/reconciliation` 上传：未绑定的云账号会弹窗提示，绑定一次后即可。

---

## 5. 关键代码地图

```
book-mall/
├─ app/
│  ├─ (account)/account/page.tsx                       # 个人中心，含「我方价目表」入口
│  ├─ (account)/account/pricing/page.tsx               # ← 新：用户视角价目表
│  ├─ admin/finance/usage-overview/page.tsx            # ← 新：管理员多维度费用
│  ├─ admin/finance/reconciliation/{page,reconciliation-client}.tsx  # ← P5 UI
│  ├─ admin/finance/pricing-templates/page.tsx         # ← 新：模板与公式可视化
│  ├─ admin/finance/cloud-pricing/page.tsx             # ← 新：价目版本索引
│  ├─ admin/finance/cloud-pricing/[versionId]/page.tsx # ← 新：版本明细行
│  ├─ api/admin/finance/reconciliation/run/route.ts    # ← P5-3 上传 CSV
│  ├─ api/admin/finance/reconciliation/bind/route.ts   # ← P5-3 云账号绑定
│  ├─ api/admin/finance/reconciliation/[runId]/clawback/route.ts  # ← P5-4 补扣
│  ├─ api/admin/finance/billing-detail-lines/route.ts  # 管理员查指定用户明细（已有）
│  └─ api/sso/tools/usage/route.ts                     # 计费上报（已移除 costPoints 兼容）
├─ components/admin/admin-nav.tsx                      # 顶部导航（已加 P5 入口）
├─ lib/finance/
│  ├─ pricing-templates/{registry,types,keys,*-v1}.ts  # 6 个模板（含 tencent 骨架）
│  ├─ reconciliation-run.ts                            # ← P5 核心 lib（CSV → ToolBillingDetailLine → Run/Lines）
│  ├─ tool-usage-billing-line.ts                       # 计价快照写入
│  ├─ cloud-bill-enrich.ts                             # 云行 → internal 快照
│  └─ cors.ts                                          # finance-web / tool-web → book-mall 跨域
├─ lib/tool-billable-price.ts                          # resolveBillableSnapshot（推断缺失 cost 字段）
├─ lib/wallet-record-tool-usage-consume.ts             # 事务核心（含水位线门禁）
├─ scripts/
│  ├─ apply-pending-migrations.ts                      # P1001 退路（DB 迁移）
│  ├─ billing-backfill-tool-usage-lines.ts             # 从 ToolUsageEvent 反向生成 Line
│  ├─ billing-refresh-tool-usage-snapshot.ts           # 刷新 TOOL_USAGE_GENERATED 行 internal* 列
│  ├─ billing-backfill-internal-pricing.ts             # 刷新 CLOUD_CSV_IMPORT 行 internal* 列
│  ├─ billing-backfill-schemea-unit-cost.ts            # ← 新：反推 ToolBillablePrice.schemeAUnitCostYuan
│  ├─ pricing-verify-billable-formula.ts               # 自洽 + 漂移
│  ├─ pricing-audit-billable-vs-source.ts              # ← 新：stored vs PricingSourceLine 人工核对报告
│  └─ reconciliation-run-cli.ts                        # ← 新：CLI 版上传，与管理端 UI 走同一 lib
└─ prisma/
   ├─ schema.prisma
   └─ migrations/20260*

tool-web/
├─ app/api/{ai-fit/try-on,text-to-image/settle,image-to-video/settle,visual-lab/analysis}/route.ts
│  # 4 个 settle 路由已移除 costPoints，只发 meta.modelId
├─ lib/forward-tools-usage-server.ts                   # postToolUsageFromServer(WithRetries)：已移除 costPoints 字段
└─ app/api/tool-usage/route.ts                         # 透传代理

finance-web/
├─ Dockerfile + docker-entrypoint.sh                   # ← 新：补齐生产部署
└─ app/admin/billing/users/[userId]/page.tsx           # 管理员账单详情（已有；viewerRole=admin）
```

---

## 6. 变更日志（commit-friendly）

```
P0  内部计价快照
    feat(finance): ToolBillablePrice 命中即固化 cost/M/ourUnit/refModel 到 ToolBillingDetailLine.internal*
    feat(finance): finance-web 按 viewerRole 隐藏 cost/系数两列（用户端只见点数和金额）

P1  schema 增强
    feat(prisma): ToolBillablePrice 加 cloudModelKey/cloudTierRaw/cloudBillingKind
    feat(prisma): PricingSourceLine 加 effectiveDiscount/effectivePromoNote/effectiveCapturedAt
    refactor(admin): server action 强制 pricePoints = max(1, round(cost × M × 100))，cost=0 拒绝

P2  公式模板与水位线
    feat(finance): 注册 internal.tool_usage_{token,seconds,image}_v1 三个公式模板
    feat(finance): recordToolUsageAndConsumeWallet 事务首部水位线门禁；402 返回 watermarkPoints+gate

P3  对账与漂移检测
    feat(scripts): pricing-verify-billable-formula 扩展 schemeAUnitCostYuan ↔ PricingSourceLine.listUnitYuan 漂移检测
    feat(scripts): pricing-audit-billable-vs-source 输出 stored 价格与源单价对照（运营每月跑）

P4  多云骨架
    feat(finance): tencent-bill-v1 模板骨架（占位 compute；接腾讯云时补具体公式）

P5  对账 UI
    feat(prisma): CloudAccountBinding + BillingReconciliationRun + BillingReconciliationLine
    feat(api): POST /api/admin/finance/reconciliation/{run,bind,[id]/clawback}
    feat(ui): /admin/finance/reconciliation 上传 / 报告 / 补扣（两次 window.confirm）
    feat(ui): /admin/finance/usage-overview 多维度费用
    feat(ui): /admin/finance/pricing-templates 模板与公式可视化
    feat(ui): /admin/finance/cloud-pricing[/[versionId]] 云厂商价目表浏览
    feat(ui): /account/pricing 用户端我方价目表

清理
    chore(billing): 删除 reconcile-against-cloud-csv / billing-deficit-claw-back / billing-import-cloud-csv 三个 CLI 脚本，统一为 reconciliation:run + 管理端 UI
    refactor(sso): POST /api/sso/tools/usage 移除 body.costPoints 兼容退路；4 个 settle 路由改为只发 toolKey + action + meta.modelId
    feat(deploy): finance-web Dockerfile + entrypoint；DEPLOY.md 三工程统一部署指南

数据维护（一次性）
    chore(data): 反推填入 ToolBillablePrice.schemeAUnitCostYuan（31 行）
    chore(data): pnpm billing:refresh-tool-usage-snapshot 重填 29 条历史 TOOL_USAGE_GENERATED 行 internal*
```

---

## 7. 发布说明（2026-05-16）

> 本节是「本次重大重构」对内的发布通告。开发完成、本地可直接跑，无需额外迁移命令。

### 7.1 本次交付（功能视角）

**管理端（顶栏 → 计费与资金）**

| 页面 | 路径 | 一句话功能 |
|------|------|---------|
| 费用多维度概览 | `/admin/finance/usage-overview` | 按月/工具/模型/用户聚合 + 最新 50 条带价格依据快照（cost/M/扣点/¥） |
| 云账单对账 | `/admin/finance/reconciliation` | 上传阿里云 CSV → 自动按云账号映射到平台用户 → 入库报告 → 亏损行二次确认补扣 |
| 计费模板与公式 | `/admin/finance/pricing-templates` | 当前注册的 6 个 `PricingTemplate` 的适用范围 / 公式 / 示例 / 代码路径 |
| 云厂商价目表 | `/admin/finance/cloud-pricing` | 按厂商/源类型列出 `PricingSourceVersion`；点击进入按模型 / billingKind 检索 `PricingSourceLine` |

**用户端（个人中心 → 费用与明细）**

| 页面 | 路径 | 一句话功能 |
|------|------|---------|
| 我方价目表 | `/account/pricing` | 全部 `ToolBillablePrice` 的零售点数与近似元数；**不暴露** cost / 系数（商业机密） |

**API（仅管理员）**

- `POST /api/admin/finance/reconciliation/run`：上传 CSV，自动对账、写入 Run/Lines
- `POST /api/admin/finance/reconciliation/bind`：补充「云账号 ID → 平台用户」绑定
- `POST /api/admin/finance/reconciliation/[runId]/clawback`：二次确认+`expectAmountPoints`双校验后幂等补扣

**安全加固（清理）**

- `POST /api/sso/tools/usage` 已**移除** `body.costPoints` 兼容退路：定价完全由服务端 `ToolBillablePrice` 决定；客户端无法影响金额。
- 工具站 4 个 settle 路由（`ai-fit/try-on` · `text-to-image/settle` · `image-to-video/settle` · `visual-lab/analysis`）已切到只发 `toolKey + action + meta.modelId`。
- 旧 CLI `reconcile-against-cloud-csv` / `billing-deficit-claw-back` / `billing-import-cloud-csv` 已删除，统一为管理端 UI + `pnpm reconciliation:run`。

**部署归档**

- `finance-web/` 补齐 `Dockerfile` + `docker-entrypoint.sh` + `next.config.mjs output:"standalone"`
- 仓库根目录 [`DEPLOY.md`](../../../DEPLOY.md)：三工程腾讯云 CloudBase Run 部署指南（生产域 `book.ai-code8.com` / `tool.ai-code8.com` / `f.ai-code8.com`；开发端口 `3000 / 3001 / 3002`）

### 7.2 已验过的数据状态

| 检查项 | 结果 |
|--------|------|
| `pnpm exec tsc --noEmit`（book-mall + tool-web） | exit 0 |
| `pnpm pricing:verify-billable-formula` | exit 0（公式自洽，drift=0） |
| `pnpm pricing:audit-billable-vs-source` | exit 0（31 行 stored 价格摆出对照，单位不可比的行作 `skipped` 报告） |
| 5 个 v002 数据库迁移 | 已 `pnpm db:apply-pending` 应用 |
| 历史数据回填（`schemeAUnitCostYuan`、TOOL_USAGE_GENERATED 行 internal\*） | 已跑 |

### 7.3 本地启动（不需再跑迁移 / 不需再跑回填脚本）

```bash
# 终端 1
cd book-mall && pnpm dev    # http://localhost:3000

# 终端 2
cd tool-web && pnpm dev     # http://localhost:3001

# 终端 3（可选）
cd finance-web && pnpm dev  # http://localhost:3002
```

### 7.4 浏览器验证清单（按顺序）

| 步骤 | URL | 期望 |
|------|-----|------|
| 1 | `http://localhost:3000/login` 登录 `13808816802@126.com` | 登录成功 |
| 2 | `/account` | 钱包余额 ¥2,970.10 (297,010 点) · 当前会员"月度订阅" |
| 3 | `/account/pricing` | 我方价目表（31 行，**含**点数与近似元数，**不含**成本/系数）|
| 4 | `/admin/finance/usage-overview` | 当前 0 条记账（已清零，干净起点） |
| 5 | `/admin/finance/pricing-templates` | 6 个计费模板卡片 |
| 6 | `/admin/finance/cloud-pricing` | 价目版本列表 → 点击进入看 `PricingSourceLine` |
| 7 | `/admin/finance/reconciliation` | 空报告页；上传 CSV 后会出现"未绑定云账号"提示 → 绑定后再传一次 |
| 8 | 工具站做一次试衣 / 文生图 / 图生视频 / 视觉问答 → 回到 `/admin/finance/usage-overview` | 出现 1 行新记账，带 cost/M/扣点/¥ 快照 |

### 7.5 测试账号管理

```bash
# 一次性把测试用户钱包/工具历史/订阅清零，并注入 ¥3000 充值 + 月度订阅扣费
pnpm dev:reset-user-billing -- --email=13808816802@126.com           # dry-run 预览
pnpm dev:reset-user-billing -- --email=13808816802@126.com --confirm # 真执行
```

脚本会幂等清空 `ToolUsageEvent / ToolBillingDetailLine / WalletEntry / Order / Subscription / UserProductSubscription / UserRechargeCoupon / BillingReconciliationLine`，再写入：
- `WalletEntry RECHARGE +300,000 点（¥3,000）`
- `Order SUBSCRIPTION PAID 2,990 点` + `Subscription monthly ACTIVE` + `WalletEntry CONSUME -2,990 点`
- 最终余额 **297,010 点 = ¥2,970.10**

### 7.6 已知限制（保留给后续）

| # | 限制 | 后续处理 |
|---|------|---------|
| 1 | `pricing-import-markdown` 解析器目前仅解析 token 区块，图像/视频区的 `perImageYuan / perSecondYuan` 没进 `PricingSourceLine.costJson` | 等接腾讯云时一并扩解析器；当前由运营人工对照 `price.md` 在「定价管理」里维护 cost |
| 2 | `PricingSourceLine.effective*` 三字段已加入 schema 但解析器没写 | 接通阿里 0.8 折等促销时回填 |
| 3 | `tencent-bill-v1` 模板仅占位 compute | 接通腾讯云账单时按 `aliyun-consumedetail-bill-v2` 的形态补 |
| 4 | `tool-web` 4 个 settle 路由本地仍有 `costPoints = compute*ChargePoints(...)` 调用，作为 "标价存在性 guard" 用 | 不影响真实扣费；后续可改为调用主站 dry-run resolve 接口统一口径 |

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-16 | 创建 0516 总文档；与 v002 实施记录交叉引用；记录本次重大重构所有数据模型、API、UI、脚本、部署的最终态。 |
| 2026-05-16 | **§7 发布说明** 追加：所有 UI 已接通、`costPoints` 兼容退路移除、旧对账 CLI 与导出 API 删除、`finance-web` 补 Dockerfile、DEPLOY.md 写完；测试账号 `13808816802@126.com` 已 reset，钱包 ¥2,970.10 + 月度订阅；新增脚本 `dev:reset-user-billing`、`pricing:audit-billable-vs-source`、`reconciliation:run`。本地直接 `pnpm dev` 即可使用，无需再跑迁移或回填脚本。 |
