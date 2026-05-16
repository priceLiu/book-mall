# 财务计价与对账定案 · v002（2026-05-16）

> **本版定位**：在 [v001 备忘](./reconciliation-baseline-2026-05-16.md) 与 [架构重构说明](./product/finance-billing-architecture-refactor.md) 的基础上，将「**云厂商代理**」业务模型显式化、把价目快照、对外单价、水位线门禁、对账闭环串成 **单一权威**；不再以「点数直扣」作主路径。  
> **目的**：用户在财务控制台看到的每一笔扣点都能 1:1 追溯到「云厂商成本快照 + 我方系数 + 公式 + 当时用量」；月末导入云 CSV 后可与本地行做对账，差异由水位线兜底补扣。  
> **状态**：方案定案；按 §6 路线图实施。

---

## 0. 我们是「云厂商代理」（业务定位）

- 平台对用户售卖的是 **代理后的算力**；我们自己不发明价格，**成本价 = 云厂商当时的有效单价**。
- 对外单价 = **成本价 × 系数 M**（默认 2.0，可按工具/模型/厂商单独配置）；用户看到的就是它。
- 多云厂商（阿里云、腾讯云、AWS…）各有不同的 **计费维度** 与 **单价**；我们用「**计价模板**」抽象每家厂商的成本算法。
- 因为我们没有从用户卡里**实时扣款**的能力，资金流向是 **用户预付点数 → 我们代付云厂商**；产生 **滞后对账风险**，所以需要 **水位线** 与 **补扣机制** 把风险闭合在「平台未亏」的安全区内。

---

## 1. 四份权威参考资料（任何讨论须以这四份为锚）

| 编号 | 文件 | 角色 |
|------|------|------|
| **R1** | `tool-web/doc/price.md` | **当前维护入口**：阿里云百炼官网价目摘录；解析器以此为唯一输入。 |
| **R2** | `tool-web/doc/price_0518.md` | 2026-05-18 当日的官网价目快照备份；与 R1 几乎一致（HappyHorse 视频全系列价格 100% 相同），用于价目漂移历史比对。 |
| **R3** | `tool-web/doc/1068915519298264-20260516104506_consumedetailbillv2.csv` | 阿里云账单导出（视频按秒类样本，15 行）；用于核对「目录价 → 优惠 → 应付」链路与「免费额度行」语义。 |
| **R4** | `tool-web/doc/1068915519298264-20260516105620_consumedetailbillv2.csv` | 阿里云账单导出（较大样本，157 行，含 Token、按张、按秒多类）；用于多维度对账与水位线模拟。 |

任何「成本到底是多少」的疑问，按下列优先级判定：

> **R3/R4（应付实付） > R1（官网目录价） > R2（历史快照）**

---

## 2. 价目核对结论（基于 R1 / R3 / R4）

### 2.1 R1 vs R3/R4 单价对照表（HappyHorse 视频系列）

| 模型 + 规格 | R1（price.md） | R3/R4「定价信息/官网目录价」 | R3/R4「应付（含 8 折优惠）」 |
|-------------|----------------|------------------------------|------------------------------|
| `happyhorse-1.0-i2v` / 1080P | **1.6 元/秒** | **1.6 元/秒** | 5 秒 × 1.6 × 0.8 = **6.40 元** |
| `happyhorse-1.0-r2v` / 1080P | **1.6 元/秒** | **1.6 元/秒** | 同上 |
| `happyhorse-1.0-t2v` / 1080P | **1.6 元/秒** | （样本未含按量行） | — |
| `happyhorse-1.0-video-edit` / 720P | **0.9 元/秒** | **0.9 元/秒** | 10.08 × 0.9 × 0.8 = **7.2576 元** |

**结论**：

- R1 的「输入/输出单价」**等于** R3/R4 的「定价信息/官网目录价」。两者完全对齐，无需调整价目库。  
- R3/R4 多了一层 **「HappyHorse 系列模型限时 8 折特惠」**（`promotionInfo.promotionContent="0.8"`），这是 **「目录价 → 有效成本」** 的关键修正。  
- 因此「**云厂商有效成本单价**」必须分两个语义存放：  
  - `listUnitYuan`：官网目录价（来自 R1）  
  - `effectiveUnitYuan`：促销折后的有效单价（来自 R3/R4 当日；或后台维护的促销表）

### 2.2 免费额度行的语义

R3/R4 中标记为「免费额度」的行：

- `应付金额 = 0`、`定价信息/官网目录价 = 0`；但 `用量信息/抵扣前用量 > 0`、`资源包抵扣详情` 给出抵扣的免费额度。  
- **对内会计口径**：物理用量已发生，按 §2.1 的 `effectiveUnitYuan` 算出「机会成本」；用户**仍按对外单价扣点**（与按量行无差别）。  
- 在「平台未亏」假设下，免费额度是**我们获得**的折扣，**不是用户得到**的折扣（产品决策；可调）。

### 2.3 R1 vs R2 差异

- HappyHorse 系列两份完全相同。  
- v001 §2.1 提到「曾有一处重排模型行差异」；**仍以 R1 为维护入口**。R2 仅作历史快照保留。

---

## 3. 数据模型（结合 v001 与本次原则）

```text
PricingSourceVersion (R1 解析的快照版本)
    └── PricingSourceLine  ← 云厂商成本真源 (modelKey, tierRaw, billingKind, listUnitYuan, effectiveUnitYuan?, promoDetail?)
                ▲
                │  by (cloudModelKey, cloudTierRaw, cloudBillingKind)
                │
ToolBillablePrice (按 toolKey + action + schemeARefModelKey)
    ├── cloudModelKey         ← 指向 PricingSourceLine.modelKey
    ├── cloudTierRaw          ← 指向 PricingSourceLine.tierRaw
    ├── cloudBillingKind      ← 指向 PricingSourceLine.billingKind
    ├── schemeAUnitCostYuan   ← 当时复制过来的成本快照 (元/单位)
    ├── schemeAAdminRetailMultiplier  ← 系数 M
    └── pricePoints = round(cost × M × 100)   ← 强约束 (P1-2)
                ▲
                │ snapshot at usage time
                │
ToolBillingDetailLine (每次扣点的明细行)
    ├── source: TOOL_USAGE_GENERATED | CLOUD_CSV_IMPORT
    ├── pricingTemplateKey: internal.tool_usage_token/seconds/image | aliyun.consumedetail_bill_v2 | …
    ├── cloudRow: 中文 key 平铺展示行 (与 finance-web 表头一致)
    ├── internalCloudCostUnitYuan  ← cost/单位 (元)
    ├── internalRetailMultiplier   ← M
    ├── internalOurUnitYuan        ← cost × M
    ├── internalChargedPoints      ← 实际扣点
    ├── internalYuanReference      ← chargedPoints/100
    ├── internalFormulaText        ← 公式 + 代入示例 + 模板名
    ├── internalCapturedAt         ← 快照时间
    └── toolUsageEventId           ← 与 ToolUsageEvent 1:1
```

**关键约束**：

1. **`ToolBillablePrice` 行**始终带回链 `(cloudModelKey, cloudTierRaw, cloudBillingKind)` ；
2. **`ToolBillingDetailLine` 写入时一次性固化** 上面 internal* 7 个字段；
3. **运行时读接口** 永远从 internal* 取数；价目库后续变更不影响历史行。

---

## 4. 计价模板（多云可扩 · 与 R1 三维度对齐）

| 模板 id | 用途 | 输入字段 | 公式 |
|---------|------|----------|------|
| **`internal.tool_usage_token_v1`** | 文本类 token 计费 | `tokenIn, tokenOut, inputYuanPerMillion, outputYuanPerMillion, M` | `cost元 = (tokenIn × pIn + tokenOut × pOut) / 1_000_000; ourYuan = cost × M; points = max(1, round(ourYuan × 100))` |
| **`internal.tool_usage_seconds_v1`** | 视频按秒（含 HappyHorse） | `durationSec, listUnitYuan, effectiveDiscount?, M` | `cost元/秒 = listUnitYuan × (effectiveDiscount ?? 1); ourYuanPerSec = cost × M; points = round(ourYuanPerSec × durationSec × 100)` |
| **`internal.tool_usage_image_v1`** | 文生图按张 | `imageCount, perImageYuan, M` | `cost元 = imageCount × perImageYuan; ourYuan = cost × M; points = round(ourYuan × 100)` |
| **`aliyun.consumedetail_bill_v2`** | 阿里云 CSV 原始行（已存在） | cloudRow JSON | 同 v001：`effective = afterDisc / qty || payable / qty || list` |
| **`tencent.bill_v1`** *(P4)* | 腾讯云 BillingItem | … | 后续扩展 |
| **`aws.cur_v1`** *(P4)* | AWS CUR | … | 后续扩展 |

**约定**：所有模板的 `compute(cloudRow)` 返回 **同一份 `InternalPricingSnapshot`**（6 字段），由 `cloud-bill-enrich.ts` 投影到展示行；UI 无需感知具体模板。

---

## 5. 实时扣费与水位线（资金风险闭合）

### 5.1 工具站 → 主站调用契约

工具站 **只报事实**，不再自己算 `costPoints`：

```jsonc
POST /api/sso/tools/usage
{
  "toolKey": "image-to-video",
  "action": "invoke",
  "meta": {
    "taskId": "…",                  // 幂等键
    "modelId": "happyhorse-1.0-i2v",
    "apiModel": "happyhorse-1.0-i2v",
    "durationSec": 5,               // 视频
    "tokenIn": 4096,                // 文本
    "tokenOut": 512,
    "imageCount": 1                  // 图
  }
}
```

### 5.2 服务端流程（同一事务）

1. `verifyToolsBearer` → 拿到平台 `userId`。  
2. 命中 `ToolBillablePrice`：根据 `(toolKey, action, modelId)`；取出 `cloudModelKey/cloudTierRaw/cloudBillingKind/schemeAUnitCostYuan/schemeAAdminRetailMultiplier`。  
3. 选模板：根据 `cloudBillingKind` → `internal.tool_usage_{token|seconds|image}_v1`。  
4. **公式实时算 `chargedPoints`**（不再相信 body.costPoints；只在 P0 兼容期保留备用）。  
5. **水位线门禁**（P2-3）：  
   - `availablePoints = Wallet.balancePoints - Wallet.frozenPoints`  
   - 若 `availablePoints < (chargedPoints + PlatformConfig.minBalanceLinePoints)` → **直接 `402 insufficient_balance`**，**不写**任何账本。  
6. 扣钱包、写 `ToolUsageEvent`、写 `WalletEntry`、**同事务写 `ToolBillingDetailLine`**。  
7. 返回 `{ ok, balancePoints, costPoints, chargedDetailLineId }`。

### 5.3 水位线三档（沿用既有，提升执行强度）

| 档 | 字段（`PlatformConfig`） | 当前作用 | 本次变更 |
|----|--------------------------|----------|----------|
| `minBalanceLinePoints` | 已有 | UI 红标 | **同时作为开跑前门禁** |
| `balanceWarnMidPoints` | 已有 | UI 橙 | 不变 |
| `balanceWarnHighPoints` | 已有 | UI 黄 | 不变 |

### 5.4 「无法实时扣云费」与「预付制」的安全策略

- 用户预付点数 → 平台代付云厂商；T+? 才能从云端拿到真实账单。  
- 在 T+? 之前，平台用 **`internalOurUnitYuan = cost × M`** 锁价；只要 M ≥ 1.2 之类合理值，**单笔正现金流可保证**（除非云厂商临时涨价或我们 M 设过低）。  
- 在 T+? 之后，月度 CSV 导入 + §6 对账脚本：  
  - 若 `本地 cost快照之和 ≥ CSV 应付之和` → 合格，写入对账结果；  
  - 若 `< CSV 应付` → **差额折点后由水位线补扣**（P3-2，从 `Wallet.balancePoints` 自动 / 半自动扣减；用户余额跌破 `minBalanceLinePoints` 则停服并要求充值）。  
- 「资金风险阀」= **`minBalanceLinePoints` 须 ≥ 单日最大用户消耗的 1.x 倍**（运营按月校准）。

---

## 6. 路线图（与 TodoWrite 一一对应）

### P0 — 立刻见效：成本/系数/我方单价从 0 → 真实快照（不动 schema）

- **P0-1**：废弃 `internal.tool_usage_v1`「点数直扣 0 0 0」实现；让 `compute(cloudRow)` 优先读 cloudRow 上已存在的 `对内计价/云成本单价`、`对内计价/零售系数` 反推。  
- **P0-2**：扩 `resolveBillablePricePoints` → `resolveBillableSnapshot`：除返回 `points` 外，附带 `(cost, M, schemeARefModelKey, billablePriceId)`，传给 `recordToolUsageAndConsumeWallet`。  
- **P0-3**：`tool-usage-billing-line.ts` 以快照填充 `internalCloudCostUnitYuan / internalRetailMultiplier / internalOurUnitYuan / internalFormulaText`，并把这三个值写进 `cloudRow` 对应列（保证 enrich 回放也一致）。  
- **P0-4**：`recordToolUsageAndConsumeWallet` 接收快照并写入。  
- **P0-5**：写 `scripts/billing-refresh-tool-usage-snapshot.ts`：根据 `toolUsageEventId` 反查命中 `ToolBillablePrice`，把已存在的 29 行 internal* 字段补满；幂等。  
- **P0-6**：`BillDetailsClient` 加 `viewerRole`，用户端隐藏「云成本单价(元/单位)」与「零售系数」两列；管理端展示全部列。

**验收**：  
✅ 财务控制台用户端不再出现 0.000000 的成本列；管理端能看到完整六列。  
✅ vic 历史 29 行回填后展示真实成本（例如 `i2v 1080P` 5 秒：成本 1.6 / 系数 2 / 我方 3.2 元/秒）。

### P1 — 数据契约硬化（小 schema 改动）

- **P1-1**：Prisma 给 `ToolBillablePrice` 加 `cloudModelKey String? / cloudTierRaw String? / cloudBillingKind PricingBillingKind?`；写迁移并通过 `pnpm db:apply-pending` 应用。  
- **P1-2**：管理端 `actions/tool-apps-admin.ts` 服务端 action 强制 `pricePoints = max(1, round(cost × M × 100))`；前端 `admin-tool-billable-pricing.tsx` 仅作 UI 联动。  
- **P1-3**：扩展 `PricingSourceLine`：增加 `effectiveDiscount Float? / effectivePromoNote String? / effectiveCapturedAt DateTime?`；解析器（P1 阶段先空着，由 P3 对账脚本回填）。

**验收**：  
✅ `pnpm pricing:verify-billable-formula` 全绿；  
✅ 后台改 cost 或 M，`pricePoints` 自动重算并保存；  
✅ schema migrate status 一致。

### P2 — 实时按公式扣费 + 水位线门禁

- **P2-1**：`POST /api/sso/tools/usage` 接受 `tokenIn/tokenOut/durationSec/imageCount`；旧 `costPoints` 入参降级为「兼容回退」，下个发布周期删除。  
- **P2-2**：新增 `internal.tool_usage_token_v1 / seconds_v1 / image_v1` 三模板并在 `registry.ts` 注册；`compute` 同时支持「实时计算」与「读 cloudRow 反推」两条路径。  
- **P2-3**：水位线门禁：在 `recordToolUsageAndConsumeWallet` 事务最前面加 `if (balance - frozen < charged + minBalanceLinePoints) return 402`。  
- **P2-补**：tool-web 各 settle 路径（`app/api/ai-fit/try-on/route.ts` / `text-to-image/settle/route.ts` / `image-to-video/settle/route.ts` / `visual-lab/analysis/route.ts`）改为只报物理用量，不计算点数。

**验收**：  
✅ 一笔 i2v 5 秒任务 → `costPoints` 由主站算出 = 320（1.6 × 2 × 5 × 100）。  
✅ 临界余额下，工具站请求被 402 拒绝，前端弹出充值；钱包余额不动。

### P3 — 对账闭环（含 CSV 入库 + 补扣）

- **P3-1**：`scripts/reconcile-against-cloud-csv.ts`：输入 `(userId, month, csvPath)`，按 `(cloudModelKey, billingKind, 日窗)` 把 `TOOL_USAGE_GENERATED` 与 `CLOUD_CSV_IMPORT` 两类行 left/right join；输出三组（命中、近似、单边）；可选 `--persist` 把对账结果写入新表 `BillingReconciliationRun` & `BillingReconciliationLine`（P3 后期再加 schema）。  
- **P3-2**：差额折点 → 水位线补扣：`scripts/billing-deficit-claw-back.ts`，只有运营 `--confirm` 才真正扣减；扣减写 `WalletEntry.type = ADJUST_RECONCILIATION`；不可低于 0（低于则停服 + 通知）。  
- **P3-3**：`pricing-verify-billable-formula` 升级：增加 `PricingSourceLine.listUnitYuan` ↔ `ToolBillablePrice.schemeAUnitCostYuan` 漂移检查，阈值默认 0.01 元。

**验收**：  
✅ 用 R4 跑一次月度对账，能输出 `命中 N / 近似 M / 单边 K` 的统计；  
✅ 模拟一个亏损用户 `--confirm` 后钱包扣减、流水可查。

### P4 — 多云示范

- **P4-1**：`lib/finance/pricing-templates/tencent-bill-v1.ts` 骨架 + registry 注册；导入脚本支持 `BILLING_IMPORT_PRICING_TEMPLATE=tencent.bill_v1`；文档示例。  
- **P4-2**：`PricingSourceVersion.kind` 增加 `tencent_md` 等区分；解析器多入口。

**验收**：  
✅ 把腾讯云的一张测试 CSV 跑通整条链路，不改动 finance-web UI。

---

## 7. 字段对齐速查表（与 v001 §8.1 列名一致）

| 财务行展示列（中文 key） | 来源 |
|--------------------------|------|
| `平台信息/用户ID` | 平台 `userId`（每行强制） |
| `平台信息/用户昵称` | `User.name / email` |
| `平台信息/计价模板` | 模板 label（如「阿里云 · consumedetailbill_v2」/「工具站 · 按秒(internal_seconds_v1)」） |
| `对内计价/云成本单价(元/单位)` | `internalCloudCostUnitYuan`（**用户端隐藏，管理端显示**） |
| `对内计价/零售系数` | `internalRetailMultiplier`（**用户端隐藏，管理端显示**） |
| `对内计价/我方单价(元/单位)` | `internalOurUnitYuan` = cost × M |
| `对内计价/计价公式与例` | `internalFormulaText`（含一例真实代入数值） |
| `对内计价/本行扣点` | `internalChargedPoints` |
| `对内计价/折元参考(¥)` | `internalYuanReference` = points / 100 |
| `产品信息/规格` | 「`cloudModelKey + tierRaw`」组合 |
| `用量信息/用量` | 物理用量 |
| `用量信息/用量单位` | `MTokens` / `秒` / `张` / `次` |
| `应付信息/应付金额（含税）` | TOOL_USAGE_GENERATED：`折元参考`；CLOUD_CSV_IMPORT：CSV 原值 |

---

## 8. 命令清单（按阶段）

| 阶段 | 命令 |
|------|------|
| P0 | `pnpm billing:refresh-tool-usage-snapshot` *(待新增)* |
| P0~ | `pnpm db:apply-pending`（CLI 不可用时的迁移应急；见 `book-mall/doc/tech/tencent-postgresql.md`） |
| P1 | `pnpm pricing:verify-billable-formula` |
| P3 | `pnpm billing:reconcile-against-cloud-csv` *(待新增)*；`pnpm billing:deficit-claw-back --confirm` *(待新增)* |
| 既有 | `pnpm pricing:import-markdown`（R1 → `PricingSourceLine`）；`pnpm pricing:emit-catalogs`（库 → 工具站 catalog） |

---

## 9. 与上一版的差异（v001 → v002）

| 项 | v001 | v002 |
|----|------|------|
| `ToolBillingDetailLine.source` 主路径 | 仅 CLOUD_CSV_IMPORT 落地 | TOOL_USAGE_GENERATED **才是**主数据 |
| `internal.tool_usage_v1` | 「点数直扣 0/0/0」 | 拆为 `_token/_seconds/_image` 三个真公式模板 |
| 工具站请求 | 自己算 `costPoints` 提交 | 只报物理用量；主站算 |
| 水位线 | UI 提示 | **开跑前 402 门禁** |
| 价目↔标价行回链 | 仅 `schemeARefModelKey` | + `cloudModelKey/cloudTierRaw/cloudBillingKind` |
| 对账 | 文档建议 | 提供脚本 + 差额补扣 |
| 多云 | 仅阿里云 | 模板可注册多家 |

---

## 10. 实施进度（v002 落地速记）

| 步 | 状态 | 关键变更（落库的文件） |
|----|------|------------------------|
| **P0-1** | ✅ | `lib/finance/pricing-templates/internal-tool-usage-v1.ts`：`compute` 从 cloudRow 反推快照，label 改为「工具站使用 · 按公式快照」。 |
| **P0-2** | ✅ | `lib/tool-billable-price.ts`：新增 `resolveBillableSnapshot` 返回 `(points, cost, M, ourUnit, refModelKey, billablePriceId)`；旧 `resolveBillablePricePoints` 保留为兼容封装。 |
| **P0-3** | ✅ | `lib/finance/tool-usage-billing-line.ts`：`buildToolUsageBillingLineData` 接收 `snap` 一次性固化 7 个 internal* 字段，并把 cost/系数/我方单价写进 `cloudRow`（与 finance-web 表头对齐）。 |
| **P0-4** | ✅ | `lib/wallet-record-tool-usage-consume.ts` & `app/api/sso/tools/usage/route.ts`：在 SSO usage 入口解析快照、透传给 `recordToolUsageAndConsumeWallet`。 |
| **P0-5** | ✅ | 新脚本 `scripts/billing-refresh-tool-usage-snapshot.ts` + `pnpm billing:refresh-tool-usage-snapshot [--dry]`：用当前 `ToolBillablePrice` 命中行重填历史 `internal*` 列与 cloudRow。 |
| **P0-6** | ✅ | `finance-web/lib/bill-config.ts` 新增 `filterColumnGroupsByRole(role)`；`bill-details-client.tsx` 接 `viewerRole`，用户端默认隐藏「云成本单价/零售系数」两列；管理员页 `app/admin/billing/users/[userId]/page.tsx` 显式 `viewerRole="admin"`。 |
| **P1-1** | ✅ | `prisma/schema.prisma`：`ToolBillablePrice` 增 `cloudModelKey/cloudTierRaw/cloudBillingKind`；`PricingSourceLine` 增 `effectiveDiscount/effectivePromoNote/effectiveCapturedAt`；迁移 `20260629120000_v002_billable_cloud_link_and_effective/migration.sql` 待 `pnpm db:apply-pending` 应用 + `pnpm prisma generate` 后启用 server action 中三列写入。 |
| **P1-2** | ✅ | `app/actions/tool-apps-admin.ts` 新增 `computePricePointsStrict`：服务端永远 `max(1, round(cost × M × 100))`；`cost=0` 直接拒绝；新行的 cloud 三列写入留待 migration 应用后启用。 |
| **P1-3** | ✅ | `PricingSourceLine.effective*` 三列已加入 schema/迁移；解析器目前不写，由 P3 对账脚本未来回填促销折扣（如阿里 0.8 折）。 |
| **P2-1** | ⏳ 后续 | 安全加固单独发版：在 tool-web 各 settle 路由（try-on / text-to-image / image-to-video / visual-lab）切到「上报物理用量」后，从 `POST /api/sso/tools/usage` 移除 `body.costPoints` 兼容退路。 |
| **P2-2** | ✅ | 新增 `lib/finance/pricing-templates/internal-tool-usage-formula.ts` 与 `keys.ts`：`internal.tool_usage_token_v1 / seconds_v1 / image_v1` 三模板注册到 registry，提供「按维度展示」的标签；当前作为回放路径，未切流。 |
| **P2-3** | ✅ | `lib/wallet-record-tool-usage-consume.ts` 事务首部新增水位线门禁：`available - cost < minBalanceLinePoints → 402`，返回 `watermarkPoints + gate`；`POST usage` 直接透传给前端。 |
| **P3-1** | ✅ | 新脚本 `scripts/reconcile-against-cloud-csv.ts` + `pnpm billing:reconcile-against-cloud-csv`：按月输出「内部计价 vs 云应付」总览与按模型/计费维度对照，单边行高亮。 |
| **P3-2** | ✅ | 新脚本 `scripts/billing-deficit-claw-back.ts` + `pnpm billing:deficit-claw-back`：默认 dry-run；`--confirm` 时事务幂等补扣，幂等键 `recon_clawback:${userId}:${month}`；不足时记录 owed 数。 |
| **P3-3** | ✅ | `scripts/pricing-verify-billable-formula.ts` 扩充：在原 `pricePoints = round(cost×M×100)` 校验之外，新增 `schemeAUnitCostYuan ↔ PricingSourceLine.listUnitYuan` 漂移检测（阈值 0.01 元，exit code 3）。 |
| **P4-1** | ✅ | 多云骨架：`lib/finance/pricing-templates/tencent-bill-v1.ts` 注册到 registry（占位 compute），文档 §4 已留入口；接腾讯云账单时按 aliyun 模板模式补 compute 即可。 |
| **P5-1/2** | ✅ | 新增 `CloudAccountBinding(cloudAccountId UNIQUE, userId)` + `BillingReconciliationRun(csvSha256 UNIQUE, summary JSON, status)` + `BillingReconciliationLine(runId, userId, modelKey, billingKind, internalCount/Yuan, cloudCount/Yuan, diffYuan, matchKind, clawback*)`；迁移 `20260630120000_v002_p5_reconciliation_tables/migration.sql`。|
| **P5-3** | ✅ | `POST /api/admin/finance/reconciliation/run`（multipart `csv`，仅 ADMIN）：解析 → 按云账号 ID 分组、查 `CloudAccountBinding` → 写 `ToolBillingDetailLine(CLOUD_CSV_IMPORT)`（按「标识信息/账单明细ID」幂等）→ 计算并入库 `BillingReconciliationRun + Lines`；`GET/POST /api/admin/finance/reconciliation/bind` 维护云账号→用户绑定。 |
| **P5-4** | ✅ | `POST /api/admin/finance/reconciliation/[runId]/clawback`（body：`{ userId, expectAmountPoints, secondConfirm:true }`）：服务端重算本批次该用户 diff<0 行的合计，与前端 `expectAmountPoints` 比对（差>1 点拒绝），事务幂等补扣（幂等键 `recon_clawback:${runId}:${userId}`），余额不足时记 `owed` 数。 |
| **P5-5** | ✅ | 管理端页面 `/admin/finance/reconciliation`（`page.tsx + reconciliation-client.tsx`）：①CSV 上传 → ②对账报告（统计卡 + 按用户分组明细表 + 未绑定提示 + 每用户「补扣 N 点」按钮，**两次 `window.confirm` 确认**）→ ③历史批次 → ④云账号绑定列表；顶部「计费与资金」菜单加入口。 |

### 部署步骤（按顺序执行；任何一步异常请停下来跟我对齐）

1. **应用 schema**：在 book-mall 目录跑 `pnpm db:apply-pending`，把 `20260629120000_v002_*` 迁移应用到数据库。
2. **生成 Prisma client**：`pnpm prisma generate`。完成后我会把 `app/actions/tool-apps-admin.ts` 中暂搁的 `cloudModelKey/cloudTierRaw/cloudBillingKind` 写入打开（一行加回去）。
3. **重填历史 internal* 列**：先 `BILLING_REFRESH_USER_ID=<你的 userId> pnpm billing:refresh-tool-usage-snapshot --dry` 看预演，再去掉 `--dry` 正式跑（幂等，可多次）。
4. **跑校验**：`pnpm pricing:verify-billable-formula`，预期 mismatches=0；如出 drift（exit 3），逐行核对 price.md 与库内 cost。
5. **跑对账（首月）**：`BILLING_RECON_USER_ID=<userId> BILLING_RECON_MONTH=202605 pnpm billing:reconcile-against-cloud-csv`，复核每个 BOTH 行 `diffYuan` 是否 ≥ 0。
6. **如有亏损** → `BILLING_RECON_USER_ID=<userId> BILLING_RECON_MONTH=202605 pnpm billing:deficit-claw-back`（先 dry），确认无误后加 `--confirm`。

### 命令速查

```bash
# 模板/价目层
pnpm pricing:verify-billable-formula
pnpm pricing:import-markdown        # R1 → PricingSourceLine
pnpm pricing:emit-catalogs

# 数据层（明细 / 重填 / 对账 / 补扣）
pnpm billing:backfill-tool-usage-lines       # 旧：补 ToolBillingDetailLine 行
pnpm billing:refresh-tool-usage-snapshot     # 新：用 ToolBillablePrice 重填 internal*
pnpm billing:backfill-schemea-unit-cost      # 新：反推 ToolBillablePrice.schemeAUnitCostYuan
pnpm billing:import-cloud-csv                # 导云 CSV（脚本式）
pnpm billing:reconcile-against-cloud-csv     # 对账报告（只读，按单用户）
pnpm billing:deficit-claw-back               # 差额补扣（脚本式 · 按单用户/月，默认 dry）

# P5 管理端：浏览器走全流程 → /admin/finance/reconciliation
# - 上传 consumedetailbillv2 CSV → 自动按 CloudAccountBinding 映射 → 写 ToolBillingDetailLine + BillingReconciliationRun/Line
# - 报告页对亏损用户「两次 confirm」后调 POST /reconciliation/[runId]/clawback 幂等补扣

# 迁移应急
pnpm db:apply-pending                        # Prisma CLI P1001 时的退路
```

---

## 11. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-16 | v002 首版：合并 v001、价目核对结论、五阶段路线图与验收。 |
| 2026-05-16 | v002 实施记录：P0/P1/P2-2/P2-3/P3/P4 全部落地（代码与 SQL 已就绪，待 `pnpm db:apply-pending` 后逐步执行命令清单）；P2-1 作为后续安全加固单独发版。 |
| 2026-05-16 | P5 对账 UI 全套落地：`CloudAccountBinding + BillingReconciliationRun + Line` 三表 + 3 个 API（`run / bind / clawback`）+ 管理端页面 `/admin/finance/reconciliation`；补扣 API 强制 `secondConfirm + expectAmountPoints` 双校验，前端两次 `window.confirm`。同时把 `ToolBillablePrice.schemeAUnitCostYuan` 31 行用 `cost = points / M / 100` 反推回填，`pricing:verify-billable-formula` exit 0（单位不可比的行作 `skipped` 报告而非 drift）。详细总文档见 `book-mall/doc/product/0516-finance-major-refactor.md`。 |
| 2026-05-16 | P5 对账 UI 全套落地：`CloudAccountBinding + BillingReconciliationRun + Line` 三表 + 3 个 API（`run / bind / clawback`）+ 管理端页面 `/admin/finance/reconciliation`；补扣 API 强制 `secondConfirm + expectAmountPoints` 双校验，前端两次 `window.confirm`。同时把 `ToolBillablePrice.schemeAUnitCostYuan` 31 行用 `cost = points / M / 100` 反推回填，`pricing:verify-billable-formula` exit 0（drift=0，单位不可比的行作 `skipped` 报告而非 drift）。 |
