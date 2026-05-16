# 对帐基础 · 需求、现状与下一步（备忘，2026-05-16）

> **⚠️ 此文档已升级到 [v002 定案版](./reconciliation-baseline-2026-05-16-v002.md)**——本文（v001）保留为讨论与背景，**实施以 v002 为准**。  
> **用途**：汇总产品侧「先建好自家可核帐能力，再与云厂商对账」的目标、已做检查、结论与实施建议，便于后续查阅与迭代。  
> **范围**：主站 `book-mall` 价目库 / 扣费流水；工具站 `tool-web` 上报与 catalog；不替代官网计费条款。

---

## 1. 需求摘要（产品目标）

1. **对内可核**：平台能用自己的数据说清楚——某段时间、某用户、某工具**扣了多少点**，与**内部定价规则**是否一致；流水可追溯、可抽查。
2. **成本可对**：单价有明确来源（如 `price.md` / `PricingSourceLine`），必要时能**复算理论成本（元）**，与向用户收的标价（点）分开建模。
3. **对云可核（长期）**：在内部帐齐的前提下，将**用量明细**或**聚合**与阿里云等**账单 CSV** 对齐，定位偏差（阶梯、折扣、版本、漏记等）。
4. **与云厂商明细「同颗粒度」**：内部对帐/export 的列语义、计费项维度（如 `token_number` / `image_number` / `video_duration`）、规格字段（商品 Code、计费项、选型配置中的模型与分辨率）应能与 **`consumedetailbillv2` 类明细** 逐列对照；**模型标识**必须能上附同一套映射表。
5. **成本价 = 免费抵扣后的有效单价**：不单独维护一套「免费版定价」。对帐与成本锚以云侧（或官网目录经同样折扣/阶梯后）**实际应付口径**为准：等价于「若没有免费额度、按现行规则应付」下的**单位资源货币成本**；免费额度行在内部可转为「目录价 × 用量 − 优惠 = 0」的**解释性明细**，但我们对**业务成本建模**用**折后有效单价**（与按量行一致），避免把云侧 0 元误认为真成本为 0。
6. **零售价规则不变**：面向用户的点单价仍由 **成本（元）× 零售系数** 推导；当前基准系数 **2.0**（与现有 `schemeAAdminRetailMultiplier` 口径一致时再固化到文档与校验脚本）。
7. **容差与水位线（预付 + 用时扣减）**：云侧出账与我们在内存中的用量统计**允许有界误差**（舍入、异步、促销细则差异），但这不是「糊过去」：须设定 **水位线**——余额低于阈值即**停止服务**，避免因滞后对帐出现大面积透支。误差要在报表里**可直观看见**（按天/按模型聚合偏差、告警阈值）。
8. **财务上避免「对用户账面为负」**：对帐视图的目标是让平台**相对云厂商**、**相对内部规则**的差异一眼可读；产品上要约束预充值与停服策略，使正常运行态下用户余额不为负。

---

## 2. 已做过的检查与结论（截至备忘编写时）

### 2.1 价目与工具站配置

| 项目 | 结论 |
|------|------|
| **成本真源（库）** | 已有 `PricingSourceVersion` / `PricingSourceLine`。`pnpm pricing:import-markdown` 从 `tool-web/doc/price.md` 合并 **中国内地 Token 表**；**非 Token**（试衣、文生图、视频规格等）在首次 `pricing:bootstrap` 进入库后，由后续 import **保留上一版中的非 Token 行**。 |
| **工具站 JSON** | `pnpm pricing:emit-catalogs` 按 `config/pricing-catalog-sync-map.json` 写回 `visual-lab-analysis-scheme-a-catalog.json` 与 `tools-scheme-a-catalog.json`。 |
| **`price.md` vs `price_0518.md`** | 两份为几乎全同的官网摘录备份；**工程仅识别 `doc/price.md`**。二者曾有一处重排模型行差异；以 `price.md` 为维护入口。 |
| **解析局限** | `price.md` 中部分表头无法映射时会被跳过（解析器 `warnings`）；**按秒 / 按张**等不进 Token 解析 JSON，需靠库内非 Token 行或人工对齐。 |

### 2.2 用户扣费与流水

| 项目 | 结论 |
|------|------|
| **扣费入口** | 工具站经 `POST /api/sso/tools/usage`；主站 `recordToolUsageAndConsumeWallet` **同事务**写 `ToolUsageEvent` + `WalletEntry`（扣余额）。 |
| **幂等** | 若 `meta.taskId` 为字符串，会生成 `WalletEntry.idempotencyKey`，避免同一任务重复扣款。 |
| **标价行** | `ToolBillablePrice` 存点数；主站可用 `schemeARefModelKey`（来自 `meta`）解析多模型单价。 |
| **成本×系数 自检** | 脚本 `book-mall/scripts/pricing-verify-billable-formula.ts`（`pnpm pricing:verify-billable-formula`）校验 `pricePoints === max(1, round(cost×M×100))`，前提是 **`schemeAUnitCostYuan` 与 `schemeAAdminRetailMultiplier` 均已录入**；曾检查到库内**几乎未同时填两项**，故「标价相对成本的自动核对」尚未成为常态。 |

### 2.3 与云对账的前置缺口（结论）

- **库内**：价目版本与工具站成本列**已有闭环**；**用户侧流水**已有。  
- **缺口**：`ToolUsageEvent.meta` **未统一要求**带上与云账单可对齐的用量（如实测 input/output Token、云侧 request_id 等）；**DB 标价行上成本锚未系统填齐**。  
→ **结论**：当前适合先做 **「用户帐 ↔ 内部规则」** 与 **「理论成本 ↔ 价目库」**；**「平台 ↔ 云账单」** 需在 **meta/字段规范 + 导出对账** 补强后再做。

---

## 3. 建议路线（接下来怎么做）

**阶段 A — 内部收入侧**  
- 补齐后台 **`ToolBillablePrice`** 的 `schemeAUnitCostYuan`、`schemeAAdminRetailMultiplier`，并定期跑 `pnpm pricing:verify-billable-formula`。  
- 报表核对：`WalletEntry` 消费与 `ToolUsageEvent.costPoints`、用户维度的聚合一致性。

**阶段 B — 内部成本侧（可复算）**  
- 统一各工具 `usage` 的 **`meta` 字段规范**（见 §5 检查表），保证每条扣费能说明「用的哪个模型、哪种计费维度、关键用量」。  
- 脚本或 SQL：用 `PricingSourceLine` + `meta` 中用量**重算理论成本（元）**，与内部记录抽样比对。

**阶段 C — 云厂商**  
- 拉取云 **账单/用量明细 CSV**；建立 **云产品线 ↔ toolKey / modelKey** 映射；先按天/模型聚合对齐，再下沉到任务级（若云侧提供）。

---

## 4. 「meta 里必填哪些键」是什么意思？（白话）

每次工具成功扣费时，主站会记一条 **`ToolUsageEvent`**，其中有一个 JSON 字段 **`meta`**（键值对附件）。

- **为什么要规定键**：对帐时要回答「这笔钱对应云上哪类调用、哪个模型、多少用量」。若 `meta` 里只有模糊信息，事后**无法**和云账单或用量 API 对齐。  
- **「检查表」**：就是列一张表——**试衣、文生图、分析室、图生视频** 各应在 `meta` 里放哪些字段（例如任务 ID、模型 ID、视频秒数等），开发按表改 `postToolUsage…` 的代码，验收时按表抽查数据库。

**不是**让用户填表；是**后端上报**时带全字段。

---

## 5. 各工具 `usage` · `meta` 检查表（现状与建议）

以下 **`toolKey` / `action`** 与 **`meta` 键** 来自当前 `tool-web` 实现（2026-05-16 前后代码）。**建议**列供对帐与云侧对齐时补强。

### 5.1 AI 试衣（成片成功）

| 字段 | 值 |
|------|-----|
| **toolKey** | `fitting-room__ai-fit` |
| **action** | `try_on` |
| **代码路径** | `app/api/ai-fit/try-on/route.ts` → `reportAiFitTryOnUsage` |

| meta 键 | 当前已有 | 对帐建议 |
|---------|----------|----------|
| `taskId` | ✅ DashScope 试衣任务 ID；**幂等键** | 保持；云对账时与任务/用量对齐 |
| `resultImageUrl` | ✅ | 可选保留（审计） |
| `persistedToOwnOss` | ✅ | 可选 |
| `pricingScheme` | ✅ `tools_scheme_a` | 保持 |
| `tryOnModel` | ✅ catalog 计费模型 id | 保持 |
| `retailMultiplier` | ✅ | 保持 |
| `inputTokens` / `outputTokens` | ❌ | 若云账单按 Token：可补（试衣多为**按张**，可能无 Token 明细） |
| `requestId`（云） | ❌ | 有则补，便于和账单行 1:1 |

### 5.2 文生图（任务成功 settle）

| 字段 | 值 |
|------|-----|
| **toolKey** | `text-to-image` |
| **action** | `invoke` |
| **代码路径** | `app/api/text-to-image/settle/route.ts` |

| meta 键 | 当前已有 | 对帐建议 |
|---------|----------|----------|
| `taskId` | ✅；**幂等键** | 保持 |
| `textToImageModel` | ✅ | 保持 |
| `imageCount` | ✅ | 保持 |
| `pricingScheme` | ✅ | 保持 |
| `retailMultiplier` | ✅ | 保持 |
| 云侧任务/请求 ID | ❌ | 有则写入 `taskId` 或单独 `requestId` |

### 5.3 视觉实验室 · 分析室（流式前预扣）

| 字段 | 值 |
|------|-----|
| **toolKey** | `visual-lab__analysis` |
| **action** | `invoke` |
| **代码路径** | `app/api/visual-lab/analysis/route.ts` |

| meta 键 | 当前已有 | 对帐建议 |
|---------|----------|----------|
| `taskId` | ✅ 实为前端 `billingRequestId`；**幂等键** | 保持；命名上可与云 request 区分时加 `billingRequestId` 别名键 |
| `modelId` | ✅ catalog 模型 id（主站解析 `schemeARefModelKey`） | 保持 |
| `apiModel` | ✅ DashScope 模型名 | 保持；**云对账关键** |
| `pricingScheme` | ✅ `visual_lab_scheme_a` | 保持 |
| `equivalentInputMillionTokens` / `equivalentOutputMillionTokens` | ✅ | 保持（与方案 A 等价用量一致） |
| `costYuanUpstreamApprox` / `retailYuanApprox` / `retailMultiplier` | ✅ | 保持 |
| **真实** `usage.prompt_tokens` / `completion_tokens` | ❌（流式结束才可知） | 若要对云 Token 账单：需在流结束后 **补记** 或 **第二条审计事件**（需产品设计） |

### 5.4 图生视频（任务成功 settle）

| 字段 | 值 |
|------|-----|
| **toolKey** | `image-to-video` |
| **action** | `invoke` |
| **代码路径** | `app/api/image-to-video/settle/route.ts` |

| meta 键 | 当前已有 | 对帐建议 |
|---------|----------|----------|
| `taskId` | ✅；**幂等键** | 保持 |
| `videoUrl` | ✅ | 可选（短期 URL） |
| `videoModel` | ✅ 与 catalog 一致的 apiModel | 保持 |
| `videoDurationSec` | ✅ | **与云按秒计费对齐的核心** |
| `videoSr` | ✅ | 保持 |
| `videoAudio` | ✅ | 保持 |
| `pricingScheme` | ✅ | 保持 |
| `retailMultiplier` | ✅ | 保持 |
| 云 `request_id` | ❌ | 可从任务 JSON 解析则补 `requestId` |

---

## 6. 相关命令（book-mall）

```bash
# Token 价目自 price.md 合并进库（须已有 current 版本）
pnpm pricing:import-markdown

# 库 → 回写 tool-web catalogs
pnpm pricing:emit-catalogs

# 标价 vs cost×M（须 ToolBillablePrice 填齐成本与系数）
pnpm pricing:verify-billable-formula
```

执行时注意使用**项目内** `dotenv-cli`（参见仓库内 `package.json` 脚本写法），避免系统其他 `dotenv` 二进制冲突。

---

## 7. 用量高峰日与样本账单交叉核对（`tool-web/doc/1068915519298264-20260516105620_consumedetailbillv2.csv`）

### 7.1 库里「扣点事件」哪几天最多？

在 `book-mall` 对 `ToolUsageEvent`（`costPoints > 0`）跑聚合（脚本：`book-mall/scripts/reconcile-busiest-day-usage.ts`）可得（**样本库、截至脚本执行时**）：

| 口径 | 日期 | 事件数 | 扣点合计 |
|------|------|--------|----------|
| **中国日历日 · 扣点最多** | 2026-05-14 | 5 | **6050** |
| 中国日历日 · 事件数最多 | 2026-05-13 | 9 | 4000 |
| UTC 日 · 事件数最多 | 2026-05-12 | 11 | 850 |

下文以 **中国历 2026-05-14**（UTC `2026-05-13T16:00:00Z`～`2026-05-14T16:00:00Z`）为主，与 CSV 中 **账单日期 `20260514`、费用类型为「云资源按量费用」** 及同日的 **「免费额度」** 行对照。

### 7.2 系统侧当日扣点明细（便于对照）

| 北京时间（约） | `toolKey` | `costPoints` | `meta.taskId`（节选） |
|----------------|-----------|-------------|------------------------|
| 05-14 00:51 | `image-to-video` | 1500 | `98e7663d-…` |
| 05-14 10:08 | `image-to-video` | 1500 | `2fd34f18-…` |
| 05-14 11:37 | `text-to-image` | 50 | `31695815-…` |
| 05-14 11:44 | `image-to-video` | 1500 | `3a3029dc-…` |
| 05-14 23:37 | `visual-lab__analysis` | 1500 | `6578915f-…` |

### 7.3 CSV 侧命中与差异（结论）

- **图生视频**：同日有两条 **按量** `video_duration` 行，消费时间 **10:08**（规格为 `happyhorse-1.0-r2v`、5 秒）与 **11:44**（`happyhorse-1.0-i2v`、5 秒），与上表第二、四条 **时刻强一致**，用量与「5 秒」颗粒度对齐。
- **首条视频（00:51）**：CSV 在 **同日** 对应时刻有一条 **「免费额度」** 行，`happyhorse-1.0-t2v`、5 秒，**用量全额抵扣**，应付为 0。系统仍按 **i2v 工具**扣点——**云侧计费模型/路径与内部工具命名不一致**时，会出现「我们这侧有点数、云侧 0 元」的结构性差异；对帐时必须用 **云规格字符串 + requestId** 做强关联，而不是只靠本地 `toolKey`。
- **文生图**：CSV **11:37** 有 **按量** `image_number` 行，`wanx2.1-t2i-plus`、**4 张**、目录口径 **¥0.8**；系统仅 **50 点** 一条事件——**按「同一时刻 + 模型家族」可命中，张数与点数需在明细公式里展开**（若内部按单任务打包扣点，需在 `BillingDetailLine` 上拆行或附「等价张数」）。
- **视觉实验室**：CSV 当日除大量 **免费额度** `token_number` 行外，尚有 **极小额按量** `qwen3-omni-flash` token 行（**13:40**）；系统 **23:37** 一条 **1500 点**——**非 1:1 行级对齐**（云侧按 input/output 拆开、且含免费抵扣）。对帐宜：**先按天+模型+计费项聚合**，再做任务级（需流式结束后补真实 token 或对接云用量 API）。

### 7.4 对「成本价 = 云侧有效单价」的样本提示

按量行中 **¥8 / 5 秒**（目录因子 **1.6 元/秒 × 5**）与常见 **8 折** 促销字段同现；**内部成本锚**应取 CSV **「优惠后金额」÷「用量」**（或等价地：促销后的 **有效单价**），而不是未发生抵扣时的目录价 alone。免费额度行的**有效单价**与同一规格下的按量行一致，**货币成本仍按该单价 × 物理用量**记入内部成本解释列，避免「0 元 = 0 成本」的会计错觉（若财务政策要求 0 成本，可在报表中分列「现金流出」与「资源机会成本」）。

---

## 8. 落地方案：财务明细完整、公式可展示、与云同格式导出

以下方案在不大改现有 `ToolUsageEvent` / `WalletEntry` 的前提下，增加一层 **「可核帐明细」**，满足前台/后台可审、可与 CSV 并列打开比对。

### 8.1 数据：一张「明细行」表 + 可选 CSV 镜像

- 新增实体（建议名：`ToolBillingDetailLine` 或 `CloudReconciliationLine`），**一行对应云 CSV 的一逻辑行**（或系统侧主动拆行后的同一粒度）。
- **必存字段（与云 CSV 对齐的列）**：账单月份、账单日期、费用类型、消费时间、产品/商品 Code、计费项 Code、`产品信息/规格` 同等语义的选型配置串、用量数值与单位、**官网目录价**与单位、**优惠后金额**、应付金额；另加 **内部 `userId`、`toolUsageEventId`、`walletEntryId`、`idempotencyKey`**。
- **定价解释列（不让人猜）**：  
  - `unitCostYuanEffective`（有效成本单价，元/单位）  
  - `retailMultiplier`（如 **2.0**）  
  - `unitRetailPoints` 或 `retailPointsPerBillingUnit`（我方标价单价，点/单位）  
  - `billingQuantity`（与云「用量」一致）  
  - `chargedPoints = f(unitRetailPoints, quantity, 舍入规则)`，并与 `WalletEntry` 关联校验  
  - `formula`：模板字符串 + 已填充变量，例如：`round(max(1, unitRetailPoints * quantity))`，并附 **一例真实数值代入**。
- **云 CSV 导入任务**：定期上传 `consumedetailbillv2.csv`，解析后写入 **`external_raw` JSON** + 规范化列；与 `ToolBillingDetailLine` 做 **match key**（消费时间 ±Δ、规格串、用量、金额）。

### 8.2 计算管线

1. **工具上报成功**时：除现有 `ToolUsageEvent` 外，由定价服务根据 `meta` + `ToolBillablePrice` + `PricingSourceLine` 生成 **1～N 条** `ToolBillingDetailLine`（例如视觉实验拆成 input/output 两行，若尚缺真实 token 则标记 `provisional=true`）。  
2. **任务结束补全**（视觉实验）：流式结束后 PATCH 明细行上的用量与公式。  
3. **月末**：导入云 CSV，对每条外部行尝试 **绑定** 内部行或生成 **unmatched** 报表。

### 8.3 UI / 导出

- **用户账单详情页**：表格列与 **阿里云明细 CSV** 同序同义（可折叠「云原始列」）；每行展开可见 **公式 + 实例演算**。  
- **管理端对帐看板**：按日汇总「云应付 vs 内部成本 vs 用户扣点折元」，**偏差 > 水位阈值**标红；下载 **与云同格式的 Excel/CSV**。

### 8.4 水位线与容差

- 配置：`STOP_REMAINING_POINTS_THRESHOLD`、`DAILY_RECON_TOLERANCE_POINTS_OR_YUAN`。  
- 运行时：`availablePoints <= threshold` → 拒绝新任务；报表：若 **|云聚合 − 内聚合| > tolerance** → 事件告警。

### 8.5 现有命令与脚本

| 用途 | 命令 |
|------|------|
| 某 UTC 窗口拉取扣点事件 JSON | `book-mall/scripts/reconcile-dump-recent-usage.ts`（`RECON_START` / `RECON_END`） |
| 统计 busiest 日 | `book-mall/scripts/reconcile-busiest-day-usage.ts` |
| 标价 vs cost×M | `pnpm pricing:verify-billable-formula` |

### 8.6 财务前端工程 `finance-web`（MVP，与云 CSV 同款列 + 对内计价列）

独立 Next 应用，与 `book-mall`、`tool-web` 并列，默认端口 **3002**：

| 说明 | 路径 / 命令 |
|------|----------------|
| 工程目录 | 仓库根目录 `finance-web/` |
| 离线样例 | `finance-web/data/consumedetailbillv2.csv`（API 失败时回退） |
| 主数据 | **book-mall** `ToolBillingDetailLine`（`cloudRow` 存云 CSV 快照）；导入：`pnpm billing:import-cloud-csv`（需 `BILLING_IMPORT_USER_ID`）；迁移目录 `prisma/migrations/20260516180000_tool_billing_detail_line` |
| 用户端 | `npm run dev` → `/fees/billing/details`；优先请求 `GET /api/account/billing-detail-lines`（见 `finance-web/.env.example`） |
| 管理端 | `/admin`、`/admin/billing/users/<User.id>`（走 `GET /api/admin/finance/billing-detail-lines?userId=`） |
| 备注 | 跨端口开发可设 `FINANCE_ALLOW_DEV_USER_QUERY=1` + `NEXT_PUBLIC_FINANCE_DEV_USER_ID`；生产宜同域或反向代理以便 Cookie。 |

---

## 9. 讨论备忘：实施范围、1:N 含义与「云主账号列」（备查）

以下摘录 2026-05-13 前后与产品/对帐相关的对齐结论，便于进入开发前复查。

### 9.1 八条需求与落地形态（结论摘要）

- **八条规则**（与云同颗粒度、有效成本单价、系数 2.0、容差与水位线、对帐可见、负余额策略、样本核对、明细+公式+同格式导出）在**产品与数据结构上均可落地**；云侧出账时滞与促销分摊差异用**容差 + 聚合对帐**消化，不指望逐笔实时与 CSV 逐字节一致。
- **用户端与管理端**：两者都复用**同一套「云明细风格」的列与语义**；管理端在同表之上增加**统计与透视**（按用户、按模型、按日、全站对云 CSV 等）。**实施顺序**：**先做用户端**明细/导出，再叠管理端。
- **用户端结果预期**：主表列尽量对齐 `consumedetailbillv2`；每行可展开 **有效成本单价、系数 2.0、我方标价、扣点/折元参考、计价公式 + 代入示例**；免费额度行按云表逻辑展示物理用量与价格解释，不把「0 应付」误当作无成本（参见 §1 需求摘要第 4～5 条、§7.4、§8）。

### 9.2 「行级 1:N」指什么（与云控制台「主账号」列无关）

- **含义**：一次在**产品内**的扣费/任务（例如一条 `ToolUsageEvent`），在**计费项维度**上，往往对应云厂商明细中的**多行**（例如文本：**input / output token 分行**；视频：**按秒**一行；图：**按张**一行等）。用户可见的「厂商格式明细」中，**允许多行**表达同一笔业务扣费，**各行点数之和**与钱包扣款一致；**不强求「用户点一次只显示一行」**，否则无法对齐云的计费项一行一用量。
- **不是**：与云控制台截图里 **订单号、资源归属账号 ID/名称** 的对应关系；也**不是说**「我们比云导出文件故意多出行」参加比赛，而是**颗粒度**按计费项拆开。

### 9.3 云侧「订单号 / 资源归属账号」与平台用户标识

- 云控制台/CSV 中常见 **资源归属账号**（及常为空的 **订单号**）描述的是**阿里云付费主体**（主账号）：全站 API 往往挂在**同一主账号**下，**无法据此区分**平台内的张三、李四。
- **我们侧必须补充**：每条明细带有 **平台用户标识**（如 `userId`、展示昵称或脱敏账号等，以合规与产品为准），必要时附加 **内部任务/流水键**（如 `toolUsageEventId`、`meta.taskId`），才能支撑「**谁**的消费明细」与客服核对。
- **表头建议（用户端）**：**先放平台用户标识列**，再跟云明细对齐列（对齐 §8.1），阅读顺序上先回答「这是我的」，再回答「和云同一套计费语义」。

### 9.4 进入下一步（实施）前可再定案的两项

- **点数与「折元参考」**：是否在用户明细中**同时展示扣点 + 折算人民币参考**（公式与汇率/点价规则写清，避免歧义）。
- **任务 ID 与云 `request_id`**：图生视频、文生图等是否在 `meta` 中**强制可关联**云侧请求/任务 ID，以提升**行级绑定**成功率（与 §5 检查表一致）。

---

## 10. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-16 | 首版：对帐需求、检查结论、三阶段建议、meta 白话说明、四工具 meta 检查表。 |
| 2026-05-13 | 增补：与云明细对齐规则、有效成本单价与系数 2.0、水位线/容差；中国历 2026-05-14 与 `1068915519298264-20260516105620_consumedetailbillv2.csv` 交叉核对；`ToolBillingDetailLine` 方案与 `scripts/reconcile-busiest-day-usage.ts`。**§9 讨论备忘**：八条需求落地结论、用户端优先、1:N 为计费项拆行、云主账号列与平台 `userId` 分工、用户端表头顺序、点数/折元与 `request_id` 待定点。 |
| 2026-05-16 | 新增 §8.6：`finance-web` MVP（用户账单详情表 + 管理端静态页）；对内计价列与 `0516` 备忘对齐。 |
| 2026-05-16 | **落地 §8.2 第 1 项**：`recordToolUsageAndConsumeWallet` 同事务写 `ToolBillingDetailLine`（`source = TOOL_USAGE_GENERATED`，`pricingTemplateKey = internal.tool_usage_v1`），财务控制台从用户进入起即可看到自己的扣点流水；与云 CSV 共表共列。新增 `pnpm billing:backfill-tool-usage-lines` 用于历史数据回填；详见 `tool-web/doc/product/finance-billing-architecture-refactor.md` §1.1 / §3.6。 |
| 2026-05-16 | **运维备忘**：本机 `pnpm db:deploy` 偶发 `P1001`（Prisma CLI schema engine 网络栈问题，与实例可达性无关）。已落地 `pnpm db:apply-pending`（`scripts/apply-pending-migrations.ts`）作为应急通道；详见 `book-mall/doc/tech/tencent-postgresql.md` 故障档案。 |
