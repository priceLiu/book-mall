# 2026-05-16 — 按秒计费（WalletHold）+ 模型校准（ModelCatalog / ModelAlias）

> 本次发布解决两个长期遗留的财务问题：
>
> 1. **按秒计费的视频工具实际是按"固定单点"扣费**——1 秒和 15 秒视频扣的点数一样，且没有在调用云厂商前做余额门禁，存在"扣到负"风险；
> 2. **同一模型在不同表里有十几个名字**（云·`商品 Code/计费项 Code/规格/产品名称` × 我们·`toolKey/scheme A 模型 id` × `price.md` 标签），对账、UI 展示、问答都没法以"模型"为主键聚合。
>
> 本次同时上线 **PlatformConfig 4 个调节参数**、`/api/sso/tools/usage` 三段式 API、`/admin/finance/model-calibration` 校准页（**支持单个录入**）。

## 价格口径（重要）

**只按挂牌价（list price）入账**——内部成本 = `unitCostYuan(挂牌)`。云侧的折扣、新人免费额度、活动赠送等 **不参与内部成本计算**；这些差额自然沉淀为平台利润，不进对账"差异"维度。

由此带来两点变化：

- `PricingSourceLine.effectiveDiscount/effectivePromoNote` 仅作"留痕"用；不再被 reconciliation 用来调整内部计费金额。
- CSV 导入页解析"优惠详情"列时，把它写入 `effectivePromoNote` 但不计入 `costJson` 单价。

## 按秒计费 / 按张计费修正

**问题根因**：`book-mall/lib/tool-billable-price.ts` 的 `resolveBillableSnapshot` 早期实现只返回 `pricePoints`，工具站算的 `costPoints` 不会被采纳——按秒模型实际就只扣了那一行 fixed pricePoints。

**修正**：`resolveBillableSnapshot` 接受 `actuals: { durationSec, imageCount, inputTokens, outputTokens }`：

- `cloudBillingKind === VIDEO_MODEL_SPEC`：`chargePoints = round( unitCostYuan × max(minBilledVideoSec, ceil(durationSec)) × M × 100 )`
- `cloudBillingKind === OUTPUT_IMAGE | COST_PER_IMAGE`：`chargePoints = round( unitCostYuan × max(minBilledImageCount, imageCount) × M × 100 )`
- 全部带 `minChargePointsPerInvoke` 兜底（避免 0 元/极低费用流水）

`/api/sso/tools/usage` POST 路径自动从 `meta.videoDurationSec / imageCount / inputTokens / outputTokens` 抽取 `actuals` 传给上述函数。**工具站既有的 settle 路由不需要改**（meta 里早就传了 `videoDurationSec`）——这是 0 改动的"自然修复"。

## WalletHold（reserve / settle / release）

**目标**：在调用云厂商前做硬门禁，避免余额 ¥10 还能发起一个会扣 ¥30 的视频任务。

### 数据模型

```
model WalletHold {
  id String @id
  userId String
  toolKey String
  action String?
  reservedPoints Int            // 估上限 × 1.2 安全边际
  status WalletHoldStatus       // HELD | SETTLED | RELEASED | EXPIRED
  taskKey String?               // 云厂商 taskId；@@unique([userId, taskKey])
  meta Json?
  expiresAt DateTime            // 默认 +30 分钟
  settledChargePoints Int?      // SETTLED 时落本次实际扣点
  settledUsageEventId String?
  releaseReason String?
}
```

可用余额 = `balancePoints − Σ(WalletHold WHERE status=HELD).reservedPoints`。

### API 形态

`POST /api/sso/tools/usage` 支持 query 或 body 的 `phase`：

| phase | 必填 body | 行为 |
|-------|-----------|------|
| `reserve` | `toolKey`、`estimatedMaxPoints`；推荐 `taskKey/action/meta` | 写入 HELD，返回 `{ holdId, reservedPoints, expiresAt }`。余额不足 / 低于水位线 → 402。 |
| `settle` | `toolKey`、`action`、`meta`、可选 `holdId` | 解析 `actuals` 计算真实 chargePoints，扣余额，写 ToolUsageEvent + ToolBillingDetailLine；若传 holdId 则同事务把 hold 转 SETTLED。 |
| `release` | `holdId` 或 `taskKey`、可选 `reason` | 把 HELD → RELEASED（幂等）。 |
| `auto`（默认） | 同 settle | 不带 phase 走旧路径——保持兼容，旧调用方零改动也能自然按秒扣对。 |

### 工具站侧改造

- **`/api/image-to-video/start`**：i2v / t2v / r2v 三个分支都在调用 DashScope **之前** 调 `reserveWalletHoldFromServer`，估算上限 = `computeVideoChargePoints({apiModel, duration, sr, audio:false}, multiplier)`。reserve 402 → 直接 returnNextResponse 透传给前端，避免无谓的云调用。返回 `{ taskId, holdId }`。
- **`/api/image-to-video/settle`**：把前端透传的 `holdId` 一并发给主站 settle。
- **`/api/image-to-video/release-hold`**（**新增**）：前端在 FAILED/CANCELED/UNKNOWN 时调用，释放 hold。
- **`image-to-video-lab-client.tsx`**：保留 `holdId`，在 settle 时携带；在轮询到失败状态时调用 release-hold（轮询超时不主动 release——保留 hold 让 TTL 自动 EXPIRED，避免误释放仍在生成中的任务）。

### TTL 自动 EXPIRED

- `lib/wallet-holds.releaseExpiredHolds()`：把 HELD 且 `expiresAt < now` 的批量转 EXPIRED。
- 触发：
  - `reserveWalletHold` 路径"机会主义"打扫——每次 reserve 前先跑一遍（O(N) 量极小）。
  - 管理后台 `POST /api/admin/wallet-holds/expire`（仅管理员）——可挂 Vercel Cron / 外部 scheduler 周期触发。

### PlatformConfig 新参数

| 字段 | 默认 | 说明 |
|------|------|------|
| `minBilledVideoSec` | 5 | 视频最低计费秒数兜底（向上取整后再取 max(本值, ceil(dur))） |
| `minBilledImageCount` | 1 | 图片最低计费张数 |
| `minChargePointsPerInvoke` | 1 | 单次调用最低扣点（避免 0 元/极低费用流水） |
| `walletHoldDefaultTtlMin` | 30 | hold 默认 TTL（分钟） |

## 模型校准（ModelCatalog / ModelAlias）

### 数据模型

```
model ModelCatalog {
  canonicalKey String  @unique     // 全站"模型"主键
  displayName  String              // 中文/规格全称
  vendor       String               // aliyun / tencent / huawei ...
  defaultTierRaw String?            // 1080P / 720P / -
  billingKind  PricingBillingKind
  unitLabel    String               // 元/秒 元/张 元/百万 tokens
  active       Boolean
}

model ModelAlias {
  catalogId   String?               // null = 待审
  source      ModelAliasSource      // 9 种（云·商品 Code / 计费项 Code / 规格 / 产品名称、内部 toolKey/action/scheme A、price.md、其他）
  aliasValue  String
  confidence  AliasConfidence       // HIGH / MEDIUM / LOW / MANUAL
  matchedBy   String?               // exact / prefix / fuzzy / manual
  @@unique([source, aliasValue])
}
```

### 自动建议器（三级）

`lib/model-catalog/suggest.ts`：

1. **exact**（HIGH）：alias 与某 `canonicalKey` 或已有 alias 完全相同（normalize 后）。
2. **prefix**（MEDIUM）：双向前缀（≥5 字符），双向择最长者；典型场景 `sfm_inferenceHH_public_cn` ↔ `happyhorse-1.0-i2v`（厂商 commodity code 与模型代号的稳定前缀关系）。
3. **fuzzy**（LOW）：Levenshtein ≤ 2 或 token-Jaccard ≥ 0.7。

### 单个录入（满足用户需求）

`/admin/finance/model-calibration` 顶部「单个录入（新建标准 + 别名）」按钮：

- 表单：`canonicalKey / displayName / vendor / billingKind / unitLabel / defaultTierRaw / note`。
- 别名分行：每行 `source + aliasValue + tierRawHint`，可加可删。
- 提交一次完成 upsert ModelCatalog + 批量挂载别名。
- 已经被挂到其他 catalog 的 alias 会被跳过（不会"抢"占用），需先在另一边解挂。

### CSV 导入自动 ingest

`runReconciliationFromCsv` 在写完 `ToolBillingDetailLine` 后，把 CSV 行的"商品 Code / 计费项 Code / 产品名称 / 选型配置规格 / 产品信息规格"展开成候选 alias，调 `ingestCandidateAliases` 跑一次自动建议。`/admin/finance/model-calibration` 打开就能看到本次导入新增的待审项。

### 账单详情读侧：canonical 覆盖（解决"头部 vs 厂商列不一致"）

**问题**：「费用明细」头部"扣点合计"按 `对内计价/本行扣点` 求和（两类行都有值），但下拉筛选的"产品名称 / 商品名称"是云 CSV 口径——同一个 `happyhorse-1.0-i2v` 在 `TOOL_USAGE_GENERATED` 行是 `产品名称="图生视频"`，在 `CLOUD_CSV_IMPORT` 行是 `产品名称="百炼大模型"`。用户一选「百炼大模型」就把自己生成的行过滤掉了，头部数掉到 0。

**修法**：新增 `lib/finance/canonical-bill-overlay.ts`——在 `enrichBillingLineToFlatRow` 之后跑一层 batch overlay：

1. 一次 SQL 把当批账单行涉及的 `规格 / 商品Code / 计费项Code / 产品名称` 全部反查 `ModelAlias`（按 source 区分），构建内存 lookup（避免 N+1）。
2. 逐行按"规格 → 商品Code → 计费项Code → 产品名称"顺序找命中。
3. 命中后覆写：
   - `产品信息/产品名称` ← `catalog.displayName`
   - `产品信息/商品名称` ← `catalog.displayName（档位）`
   - `产品信息/产品Code` ← `catalog.canonicalKey`
   - 新增列：`产品信息/标准模型` = `catalog.canonicalKey`、`产品信息/档位` = 行内推断或 catalog 默认值
4. 找不到 → 原值原封不动（向后兼容）。

**接入点**：三个读路由都已接入——`POST /api/account/billing-detail-lines`、`POST /api/admin/finance/billing-detail-lines`、`POST /api/sso/tools/billing-detail-lines`。

**finance-web 显示**：`lib/bill-config.ts` 把"标准模型 / 档位"两列加入 `产品信息` 列组，直接展示。

**运营前置条件**：只有当 `ModelCatalog/ModelAlias` 有对应映射时，覆盖才生效；这次的 release 不预填任何 catalog 数据。建议运营首次打开 `/admin/finance/model-calibration` 时：
- 把当前热门模型（happyhorse-1.0-i2v、qwen-image-2.0、qwen-image-edit、aitryon 等）通过"单个录入"建好；
- 或：导入近期 CSV，让 reconciliation 自动 ingest 候选别名，再一键批准 HIGH 置信项。

完成后所有历史 + 新增账单行都会自动归一，「头部统计」与「厂商列筛选」从此一致。

## 页面与路径

- **`/admin/finance/model-calibration`**（**新**）：模型校准页（KPI + 待审三栏 + catalog 列表 + 单个录入弹窗 + 批量导入弹窗）。
- **`POST /api/admin/wallet-holds/expire`**（**新**）：手动触发 hold 过期回收（管理员）。
- **`POST /api/image-to-video/release-hold`**（**新**）：工具站前端在视频失败时调用。

## 变更影响面

- **现有钱包扣费链路**：完全向后兼容。旧调用方（不带 phase）走 `auto` → 现在自动按秒扣对（之前是按 fixed pricePoints）。
- **现有 CSV 导入对账**：完全向后兼容。新增的别名 ingest 是只写、不读——尚未挂到 catalog 的别名不影响现有聚合（`modelKeyFromCloudRow` 行为不变）。后续可在对账聚合阶段叠加 canonical 解析（参见 `lib/model-catalog/resolve.ts`，已就绪未调用）。
- **schema 迁移**：`prisma/migrations/20260516220000_per_second_billing_and_model_calibration/`，4 张表/枚举新增 + PlatformConfig/ToolUsageEvent 加列；本地用 `pnpm db:apply-pending`（事务超时已放宽到 120s）。

## 验收清单

- [x] 主站 `tsc --noEmit` 通过
- [x] 工具站 `tsc --noEmit` 通过
- [x] Prisma schema validate 通过 + migration 应用成功 + `prisma generate`
- [x] `/admin/finance/model-calibration` 出现在管理员侧栏「计费与资金」下
- [x] reserve / settle / release 三个 phase 在路由层均有处理（含 402 / 404 / 409 状态码）
- [x] 工具站视频 start → settle 链路携带 holdId（落 ToolUsageEvent.walletHoldId）
- [x] WalletHold TTL：reserve 路径前会先跑过期清理
- [x] 单个录入支持新建 + 多别名挂载，冲突 alias 跳过不丢失原绑定
- [ ] **运营验收**：导入一份新 CSV 后在校准页可见待审项；点接受能挂上；用户做 5 秒视频时实扣点 ≈ `挂牌单价 × 5 × 系数 × 100`，做 15 秒视频时实扣点 ≈ `× 15 ×`
- [ ] **运营验收**：余额低于 reserve 预估时，start 接口直接 402 而不发起 DashScope 调用（节省云费）

## 后续：3 处已知遗留补齐

### 1. settle 事务内"其它 HELD"硬门禁（防并发 hold 走穿）

`recordToolUsageAndConsumeWallet` 内的水位线门禁原来只算 `balance − frozen`，现追加：

```
otherHeld = SUM(WalletHold WHERE userId AND status=HELD AND id != settlingHoldId)
available = balance − frozen − otherHeld
if available < cost                            → balance gate fail
if watermark > 0 && available − cost < watermark → watermark gate fail
```

当前 settle 自身绑定的 `walletHoldId` 不计入扣减（它即将被本次 settle 释放并替换成真实扣费）。修复极端并发场景下"在 hold 内已 settle、但水位线检查没把另一笔并发 hold 算进可用余额"的走穿风险。

### 2. 对账聚合阶段叠 canonical（同模型多名字自动归并）

`reconciliation-run.ts` 聚合循环开始前先 `canonicalKeysByAliases`（按规格 / 商品Code / 计费项Code / 产品名称 反查 `ModelAlias`）批量解析，然后聚合 key 改为 `${userId}::${canonicalKey || modelKey}::${billingKind}`。这样：

- 同一 `happyhorse-1.0-i2v` 在不同 CSV 月份用了 5 种字串都自动归并到同一行；
- `BillingReconciliationLine.modelKey` 直接保存 canonical key（管理后台对账看板的"模型"列就是标准名）；
- 还未校准的模型保留原值（向后兼容）。

### 3. 文生图 / AI 试衣 start 端接入 reserve

按 image-to-video 同 pattern 复制：

| 工具 | 估上限算法 | 文件 |
|---|---|---|
| 文生图 | `computeTextToImageChargePoints(n, model, multiplier)` | `tool-web/app/api/text-to-image/start/route.ts` |
| AI 试衣 | `computeAiTryOnChargePoints(modelId, multiplier)` | `tool-web/app/api/ai-fit/try-on/route.ts` |

- **start** 前 reserve；调云失败 release；
- **settle** 时附带 `holdId` 给主站把 hold 转 SETTLED；
- AI 试衣是 POST/GET 异步轮询模式，**POST 拿到的 holdId 缓存到内存 (`holdIdByTryOnTaskId`, TTL 20 分钟)**，GET 在 `reportAiFitTryOnUsage` 内按 taskId 反查后透传；
- 文生图客户端 (`text-to-image-generate-modal.tsx`) 用 `settleHoldIdRef` 把 holdId 从 start 透到 settle 调用。

**visual-lab/analysis 不加 reserve**——它的工作模式是"先 sync settle 再调云" (`postToolUsageFromServerWithRetries` 在 OpenAI stream 调用之前)，天然挡住超扣，加 reserve 反而增加无谓的 hold 写盘 + release 路径。这一例外在 `doc/logic/admin-billing-and-refunds.md` 里也补了说明。

## 自动校准（同模型差额对账写侧归并 / 零手工启动）

旧版本要求运营**逐条手建 ModelCatalog 才能让"头部 vs 厂商列"一致**——门槛太高。本轮把校准做成一键。

### 新增 `lib/model-catalog/auto-calibrate.ts`

三阶段顺序执行（高可信度优先）：

1. **从 `ToolBillablePrice` 派生 catalog**：扫所有 `schemeARefModelKey IS NOT NULL` 且 `cloudBillingKind IS NOT NULL` 的行，每个 `schemeARefModelKey` 派生一行 `ModelCatalog`（unitLabel 按 billingKind 自动选「元/秒 / 元/张 / 元/百万 tokens」），同步挂载 `(INTERNAL_SCHEME_A_MODEL, schemeARefModelKey)` alias。
2. **从 `PricingSourceLine` 派生 catalog**：取最新一个 `isCurrent=true` 的价目版本，每个 `modelKey` 派生一行（vendor=aliyun，tier 用 `tierRaw`），同步挂载 `(VENDOR_RESOURCE_SPEC, modelKey)` alias。
3. **auto-bind pending aliases**：扫所有 `catalogId IS NULL` 的 alias，重跑 `suggestAliasMatches`——**HIGH/MEDIUM 直接绑定**，LOW 仍留待审（避免错绑）。

### 一键入口

- **UI**：`/admin/finance/model-calibration` 顶栏新增「**一键自动校准**」按钮（`Wand2` 图标）。完成后展示 `新建 catalog：按次价X / 成本源Y；自动绑定 alias：HIGH X / MEDIUM Y；LOW 待审：Z` 弹幕，8 秒后消失。
- **CSV 导入自动触发**：`runReconciliationFromCsv` 在 `ingestCandidateAliases` 之后**自动**再跑一次 `runFullAutoCalibration`。每次上传新 CSV 都会顺手把新模型 seed 进 catalog 并绑定。

### 写侧固化 canonical（同模型差额"在写入时"归并）

之前只在**读侧** `applyCanonicalOverlayBatch` 做覆盖；本轮把同一套做到**写侧**：

- `lib/finance/tool-usage-billing-line.ts` 新增 `ToolUsageCanonicalHint` 类型；`buildCloudRowFromUsage` 接收 `canonical?`，命中后 cloudRow 内 `产品信息/标准模型 / 产品Code / 商品Code / 产品名称 / 商品名称` 全部写成 catalog 标准值（**不命中**则保持 `toolKeyToLabel` 兜底，与历史行为一致）。
- `lib/wallet-record-tool-usage-consume.ts` 在事务前 `resolveCanonicalFromMeta(meta)` 一次查 alias→catalog（命中 `(INTERNAL_SCHEME_A_MODEL, modelId/tryOnModel/videoModel/textToImageModel/apiModel)` 任一），把结果传给 `buildToolUsageBillingLineData`。

由此：**新增的 `TOOL_USAGE_GENERATED` 行写入时就已经是 canonical 口径**，对账聚合 / 头部统计 / 厂商列下拉天然一致——同模型多名字差额从此在写入侧就归并；读侧 overlay 仍然存在（用作历史行 + 旧迁移数据的兜底覆盖）。

### 新 server action

- `runAutoCalibrationAction()`：admin 权限校验 → 调 `runFullAutoCalibration()` → `revalidatePath`。返回 `{ kind, message, detail }`。

## 仍未处理（明确留作下次迭代）

- AI 试衣 POST 阶段 reserve 成功但 GET 阶段 settle 因配置异常返回 503/非余额错误时，hold 当前依赖 TTL 自动 EXPIRED（默认 30 分钟）；下次可以让 `reportAiFitTryOnUsage` 在非 402 失败时主动 release。
- 自动校准 Phase 2（从 `PricingSourceLine` 派生）默认所有行 vendor=aliyun。后续若接入其它厂商，需在 schema 或导入器侧带 vendor 字段。

## Hotfix（2026-05-16，晚间）

### 文生图未扣费 / settle 500

**现象**：用户跑文生图，图正常生成，但钱包未扣点；`POST /api/sso/tools/usage?phase=settle` 返回 500。

**根因**：`recordToolUsageAndConsumeWallet` 内的 `prisma.$transaction` 使用 Prisma 默认 `timeout: 5000ms`。本轮 v003 新加了：

1. `tx.platformConfig.findUnique`（水位线参数）
2. `tx.walletHold.aggregate`（**其它 HELD** 门禁，并发 hold 防超扣）

合计事务内有 8+ 次顺序 DB I/O；dev 模式下叠加 webpack 冷启动 + 远端 PG RTT，**5079ms 打穿 5000ms 上限**，P2028。事务回滚 → `ToolBillingDetailLine` 未写 → 钱包未扣。

**修复**：在 `lib/wallet-record-tool-usage-consume.ts` 的 `$transaction(...)` 上加第二参 `{ maxWait: 10_000, timeout: 30_000 }`（同口径于 `apply-pending-migrations.ts`）。生产 settle 一般 < 200ms，30s 仅作上限保护。

### `/admin/finance/cloud-pricing` 报 `vendorOfModelKey is not a function`

**根因**：`vendorOfModelKey` 原本位于 `"use client"` 文件 `cloud-pricing-master-client.tsx`。Server Component (`page.tsx`) 跨越 RSC 边界 `import { vendorOfModelKey }` 时，webpack 把 client module 替换成 client-reference proxy，运行时该字段不是函数。

**修复**：新建纯 utility `lib/finance/vendor-of-model-key.ts`（无 React / 无 "use client"），把函数体迁过去；`page.tsx` 改从该路径 import；`cloud-pricing-master-client.tsx` 保留 `export { vendorOfModelKey } from ...` 以兼容仍走旧路径的旧 import。

### `/admin/finance/model-calibration` 报 `"use server" file can only export async functions, found object`

**根因**：`app/actions/model-calibration.ts` 顶部 `"use server"`，但同时 `export type CalibrationActionState` 与 `export const calibrationActionIdle = { kind: "idle" }`。Next.js 14 在 server-action loader (`action-validate.ts`) 校验"`"use server"` 文件只能 export async 函数"时拦下了 const 对象——整个页面 500，**这正是用户上一轮反馈"模型校准页 / 一键自动校准按钮 没看到任何变化"的真因**（页面被 server action 校验挡掉了）。

**修复**：

- 新建 `app/actions/model-calibration-state.ts`（**不带** `"use server"`），把类型 `CalibrationActionState` 与常量 `calibrationActionIdle` 迁过去；
- `model-calibration.ts` 改用 `import type { CalibrationActionState } from "./model-calibration-state"`（TS 编译期擦除，runtime 无遗留 export）；
- `model-calibration-client.tsx` 改从新文件 import 常量与类型。

跑 `pnpm exec tsc --noEmit` 通过。重新加载 `/admin/finance/model-calibration` 即可看到本轮新增的「一键自动校准」按钮、目录表、待审别名表、批量导入候选等所有 UI。

---

# 2026-05-17 — 费用明细按 `0516.xlsx` 重构 + 计费数据清零（v004）

## 背景

用户提供新模板 `tool-web/doc/0516.xlsx`，明确我方费用明细的目标列结构（**仿阿里云 CSV** 字段 + **平台 8 列**）。旧的 14 组 ~50 列表格在前端**完成度差**、新增列散落各处，且存在以下问题：

1. 「对内计价/* 」6 列（云成本单价 / 零售系数 / 我方单价 / 计价公式 / 本行扣点 / 折元参考）**与 `ToolBillingDetailLine.internal*` 7 列重复**——同一份数据既写 cloudRow JSON 又写 DB Decimal，长期不一致风险；
2. 「产品信息/标准模型 + 档位 + 选型配置 + 规格 + 产品Code」是早期为做 reconciliation join 临时塞的"中间列"，前端展示无意义；
3. 「时长信息」整组（5 列）、「身份信息」整组（5 列）、「订阅抵扣」整组、「优惠券抵扣」整组、「资源信息/资源ID + 资源名称 + 地域三列」、「标识信息/账单明细ID + 订单号」、「账单信息/服务主体 + 交易类型」、「用量信息/抵扣用量 + 用量详情」、「定价信息/用量阶梯累计规则 + 目录价转换信息 + 目录价因子」、「费用信息/计费辅助信息 + 计费过程 + 计费规则说明」全部**前端不显示也无功能依赖**——纯包袱；
4. 「平台信息/用户ID + 用户昵称 + 计价模板」前缀语义偏弱，且没有把"M 系数 + 平台定价 + 实际扣点"挂在同一组下，用户对账时要在表头里跳跃式阅读。

## 列结构（v004 / 8 组 32 列）

`book-mall/lib/finance/bill-display-keys.ts` 与 `finance-web/lib/bill-config.ts` 严格镜像同步：

| # | 组         | 列                                                                                                            | 备注 |
|---|------------|---------------------------------------------------------------------------------------------------------------|------|
| 1 | 平台信息   | 用户ID(admin) · 用户名 · 产品Code · 产品名称 · 计费项Code · 系数(M)(admin) · 定价 · 扣点                       | 全部 `平台/` 前缀 |
| 2 | 账单信息   | 账单月份 · 账单日期 · 费用类型 · 消费时间 · 服务开始时间 · 服务结束时间                                        | 与阿里云 CSV 字段名一致 |
| 3 | 产品信息   | 产品名称 · 商品Code · 商品名称 · 计费项Code · 计费项名称                                                       | 与 CSV 一致 |
| 4 | 资源信息   | 实例ID（出账粒度）                                                                                            | 单列；用户路径取 taskId/billingRequestId/modelKey 兜底 |
| 5 | 用量信息   | 抵扣前用量 · 用量 · 用量单位                                                                                  | 真值（无折扣／抵扣概念） |
| 6 | 定价信息   | 官网目录价 · 价格单位 · 目录价用量阶梯 · 定价币种                                                              | 阶梯 `[0,9999999999999]` 前端折叠为「无阶梯」 |
| 7 | 费用信息   | 计费公式 · 目录总价                                                                                            | 与 CSV 一致 |
| 8 | 优惠信息   | 优惠金额 · 优惠详情                                                                                            | **补回**：财务对账必备 |
| 9 | 应付信息   | 应付金额（含税）                                                                                              | **补回**：财务对账必备；前端按行合计、按筛选求和 |

> 8/9 两组**与阿里云 CSV 原始 prefix 一致**（`优惠信息/* / 应付信息/*`），导入 CSV 时透传无需转写。

**Admin-only 白名单**：`平台/用户ID` 与 `平台/系数(M)` 仅管理员视角可见；用户视角看到平台对外单价 + 实际扣点已足够审计。

## 删除清单（代码 + 数据）

### cloudRow JSON 内不再写入的字段（旧行已重置，不再有兼容包袱）

- 「对内计价/云成本单价(元/单位)」、「对内计价/零售系数」、「对内计价/我方单价(元/单位)」、「对内计价/计价公式与例」、「对内计价/本行扣点」、「对内计价/折元参考(¥)」  ← 改由 `ToolBillingDetailLine.internal*` 7 列承担；enrich 时 read DB 列注入「平台/系数(M) + 定价 + 扣点」
- 「平台信息/用户ID」、「平台信息/用户昵称」、「平台信息/计价模板」  ← 改用「平台/用户ID」、「平台/用户名」（admin 与 user 视图按 `ADMIN_ONLY_KEYS` 过滤）
- 「产品信息/标准模型」、「产品信息/档位」、「产品信息/选型配置」、「产品信息/规格」、「产品信息/产品Code」（在 TOOL_USAGE_GENERATED 行）  ← canonical 信息全部经由「平台/产品Code + 产品名称」表达
- 「账单信息/服务主体」、「账单信息/交易类型」、「用量信息/用量详情」、「费用信息/计费规则说明」、「标识信息/账单明细ID」、「标识信息/订单号」  ← 前端不显示也无后端逻辑依赖

### display config 不再呈现的字段（CSV 行的 cloudRow JSON 仍透传，仅前端裁剪）

- 「时长信息/抵扣前时长 + 抵扣时长 + 时长 + 时长单位 + 时长详情」（5 列整组）
- 「身份信息/客户名称 + 资源购买账号ID + 资源购买账号 + 资源归属账号ID + 资源归属账号」（5 列整组）
- 「订阅抵扣信息」（4 列整组）
- 「优惠券抵扣信息」（2 列整组）
- 「资源信息/资源ID + 资源名称 + 地域Code + 地域 + 可用区」（5 列；仅保留「实例ID（出账粒度）」）
- 「定价信息/用量阶梯累计规则 + 目录价转换信息 + 目录价因子」
- 「费用信息/计费辅助信息 + 计费过程 + 计费规则说明」
- 「用量信息/抵扣用量」
- 「平台信息/计价模板」

> Reconciliation 仍可从 cloudRow JSON 读 CSV 原列（`身份信息/资源购买账号ID`、`标识信息/账单明细ID` 等）做 join——只是不在前端列表展示。

### 代码级清理

- 删除 `lib/finance/pricing-templates/internal-tool-usage-formula.ts`（3 个公式型模板 `internal.tool_usage_{token,seconds,image}_v1`）—— v004 后 cloudRow 不再写对内计价 6 列，这 3 个 compute() 失去意义；
- 删除 `lib/finance/pricing-templates/keys.ts` 的 `PRICING_TEMPLATE_INTERNAL_TOOL_USAGE_{TOKEN,SECONDS,IMAGE}_V1` 三个常量与 `registry.ts` 对应注册项；
- 简化 `lib/finance/pricing-templates/internal-tool-usage-v1.ts`：`compute()` 返回全 0 占位快照（兜底死路径，`enrichBillingLineToFlatRow` 优先用 DB internal* 派生快照，不会走 compute）；
- 简化 `lib/finance/canonical-bill-overlay.ts`：删除 `K_CANONICAL = "产品信息/标准模型"` 和 `K_TIER = "产品信息/档位"` 写入；catalog 命中后改为写「平台/产品Code + 平台/产品名称 + 平台/计费项Code」3 列；
- 重写 `lib/finance/cloud-bill-enrich.ts`：删除「对内计价/* + 平台信息/*」9 列写入；按 `persisted` DB internal* 列派生「平台/系数(M) + 平台/定价 + 平台/扣点」；
- 重写 `lib/finance/tool-usage-billing-line.ts`：cloudRow JSON 直接按 v004 8 组 32 列输出；新增「平台/* 8 列」+「应付信息/应付金额（含税）」+「优惠信息/优惠金额 + 优惠详情」写入；
- `lib/wallet-record-tool-usage-consume.ts` 新增 `resolveUserHint(userId)`：事务前一次 SELECT `User.name|email`，传给 builder，避免每条 cloudRow 让 enrich 端再查；
- `scripts/billing-refresh-tool-usage-snapshot.ts` 同步接入 `userHint`（命中缓存按 userId）。

### 数据库 schema

**v005（2026-05-17）追加**：**删除** `ToolBillingDetailLine.internal*` 7 列（`internalCloudCostUnitYuan` / `internalRetailMultiplier` / `internalOurUnitYuan` / `internalFormulaText` / `internalChargedPoints` / `internalYuanReference` / `internalCapturedAt`）——v004 已经把价格快照固化到 cloudRow JSON 的「平台/系数(M) + 平台/定价 + 平台/扣点」键，DB Decimal 列与 JSON 一直双写，长期不一致风险大。所有读端均改为从 cloudRow 派生：

- `lib/finance/cloud-bill-enrich.ts`：删除 `internalPricingSnapshotFromLine` / `prismaDataFromInternalSnapshot`；`enrichBillingLineToFlatRow` 入参收紧为 `{ cloudRow }`；CSV 行的「平台/扣点」从「应付信息/应付金额（含税）」× 100 派生；
- `lib/finance/tool-usage-billing-line.ts`：`buildToolUsageBillingLineData` 返回值删除 7 字段，只剩 `{ userId, toolUsageEventId, source, cloudRow, pricingTemplateKey }`；
- `lib/finance/reconciliation-run.ts`：CSV import 时把价格快照通过 `computeInternalPricingWithTemplate` 直接 spread 到 cloudRow 的「平台/*」键；聚合时改读 `cloudRow["平台/扣点"] / 100`；
- `app/admin/finance/usage-overview/page.tsx`：删除 `select { internal* }`；新加 `platformPointsOf / platformMultOf / cloudUnitCostYuanOf` 3 个 helper 从 cloudRow JSON 读；
- `usage-overview-export-button.tsx`：`ExportLine` 字段重命名（`internalCloudCostUnitYuan` → `cloudUnitCostYuan`、`internalRetailMultiplier` → `retailMultiplier`、`internalChargedPoints` → `chargedPoints`），数据语义不变；
- `scripts/billing-refresh-tool-usage-snapshot.ts`：`update` 调用只剩 `{ cloudRow, pricingTemplateKey }` 两字段；
- `scripts/billing-backfill-internal-pricing.ts`：**整文件删除**——schema 列删了，此脚本无意义；package.json 同步删除 `billing:backfill-internal-pricing` 命令；
- `lib/finance/pricing-templates/internal-tool-usage-v1.ts` + `lib/tool-billable-price.ts`：注释里关于 internal* 的描述同步更新。

迁移 SQL：`prisma/migrations/20260701120000_drop_tool_billing_line_internal_pricing/migration.sql`，7 个 `DROP COLUMN IF EXISTS`。已通过 `pnpm db:apply-pending` 应用至本地 dev 库（腾讯云 tool_mall）。

**不动**：`ToolBillablePrice`、`PricingSourceLine`、`ModelCatalog`、`ModelAlias`、`SubscriptionPlan` 等结构性表完整保留。

## 数据清零

新增 `book-mall/scripts/reset-billing-data.ts`（package.json 新增 `billing:reset-data` 命令）：

- **删**：`ToolBillingDetailLine`、`BillingReconciliationLine`、`BillingReconciliationRun`、`ToolUsageEvent`、`WalletHold`、`WalletEntry`、`WalletRefundRequest`、`SubscriptionRefundRequest`、`Subscription`、`Order` 全表；
- **重置**：所有 `Wallet.balancePoints=0, frozenPoints=0`；
- **种子**（`--user <id>`）：给指定 user 写 1 条 `WalletEntry(RECHARGE, amount=300_000, balance=300_000, idempotencyKey=reset-v004-recharge:<userId>)`，钱包余额 = 300_000 点（¥3000）；查到第一条 `interval=MONTH, active=true` 的 `SubscriptionPlan` → 写 1 条 `Subscription(period=now ~ now+30d, status=ACTIVE)`。

用法：

```bash
# dry-run（默认）：列出即将执行的操作，但不写库
pnpm billing:reset-data -- --dry --user <userId>

# 正式执行：清零 + 种子
pnpm billing:reset-data -- --apply --user <userId>

# 可选：手动指定订阅 slug
pnpm billing:reset-data -- --apply --user <userId> --monthly-plan-slug pro-monthly
```

**本次执行结果**（2026-05-17 00:51 UTC+8 / user=`cmp1b8wun0000r0zdar41scra` vic）：

| 项 | before | after |
|----|--------|-------|
| ToolBillingDetailLine | 1 | 0 |
| ToolUsageEvent | 1 | 0 |
| WalletHold | 1 | 0 |
| WalletEntry | 3 | 1（RECHARGE +300000） |
| Subscription | 1 | 1（slug=monthly，period=now ~ +30d） |
| Order | 1 | 0 |
| Wallet.balancePoints (vic) | — | 300000（¥3000） |

## 前端 UI 变化

`finance-web/components/bill-details-client.tsx`：

- 头部统计从 1 个"筛选范围内扣点合计"扩展为 **3 个合计**：
  - 平台扣点合计（按「平台/扣点」累加）
  - 云目录总价合计（按「费用信息/目录总价」累加，方便对比"如果按云目录付要多少钱"）
  - 云应付合计（按「应付信息/应付金额（含税）」累加）
- 行 key 从「标识信息/账单明细ID」改为「平台/用户ID + 消费时间 + 计费项Code + 用量」拼合（前者已删，新组合在同行内稳定唯一）；
- 「定价信息/目录价用量阶梯」列：`[0,9999999999999]` 折叠显示为 **「无阶梯」**（阿里云的"无阶梯占位"语义，原始字符串保留在 cloudRow 内）；
- 筛选维度的"产品名称"主键从「产品信息/产品名称」改为「平台/产品名称」——TOOL_USAGE_GENERATED 与 CLOUD_CSV_IMPORT 两类行经 overlay 后此列一致，可直接 group by。

## 校验

- `book-mall` 与 `finance-web` 双 tsc `--noEmit` 均通过；
- `next lint` 在 book-mall 仅剩 2 个**预存在**的 react/no-unescaped-entities + 1 个 ARIA 警告，均非本轮引入；
- 重置后跑一次 reserve→settle / 直扣 / CSV 导入 / canonical overlay，前端 8 组 32 列全部对位显示，admin 视角额外可见「平台/用户ID」。

## Hotfix（2026-05-17，凌晨）

用户实测后反馈两个问题，本节合并记录：

### Round 1：「产品信息」组写错 + 「系数(M)」对用户能看到

- **「产品信息/*」5 列被错填为我们的 toolKey/action**（截图 `AI智能试衣 / fitting-room__ai-fit / try_on`）。
- 修复：`book-mall/lib/finance/tool-usage-billing-line.ts` 的 `buildCloudRowFromUsage` 把这 5 列**显式置空**——「产品信息/*」语义是**云厂商 CSV 原列**（百炼大模型 / Happy 系列 / `bailian_*` / `video_duration`），TOOL_USAGE_GENERATED 行没有"工具 → 云商品/计费项"的可靠映射就应该留空。我方对外标识已在「平台/产品Code + 产品名称 + 计费项Code」3 列里独立承担。
- 跑 `BILLING_REFRESH_USER_ID=<userId> pnpm billing:refresh-tool-usage-snapshot` 把历史 TOOL_USAGE_GENERATED 行 cloudRow 按新规则重写（1 行更新）。

### Round 2：角色策略最终版

用户进一步澄清需求：

- **用户视角**：不需要看「系数(M)」、不需要看整组「产品信息」（云厂商内部命名跟用户无关）。
- **管理员视角**：完整可见（系数 + 产品信息 + 用户 ID）。

调整：

- `book-mall/lib/finance/bill-display-keys.ts` + `finance-web/lib/bill-config.ts`：
  - `ADMIN_ONLY_KEYS = ["平台/用户ID", "平台/系数(M)"]`（恢复 M 为 admin-only）
  - 新增 `ADMIN_ONLY_GROUPS = ["产品信息"]`——`filterColumnGroupsByRole` 现在对 user 视角会先按整组过滤再按 key 过滤，整组隐藏的清单可扩展。
- 入口路由：
  - `/admin/billing/users/[userId]` → `viewerRole="admin"` → 完整 8 组 ≥ 32 列
  - `/fees/billing/details` → 用户视角 → 7 组 ≥ 26 列（少掉「平台/用户ID」「平台/系数(M)」「产品信息」组 5 列 = -7 列）

行为对照（更新后）：

| 列组 / 列 | TOOL_USAGE_GENERATED 行 | CLOUD_CSV_IMPORT 行 | 用户视角 | 管理员视角 |
|---|---|---|---|---|
| 平台/产品Code | catalog.canonicalKey \|\| toolKey | overlay 反查命中 | ✓ | ✓ |
| 平台/产品名称 | catalog.displayName \|\| toolLabel | 同上 | ✓ | ✓ |
| 平台/计费项Code | action | CSV 兜底 | ✓ | ✓ |
| 平台/系数(M) | snap.retailMultiplier | computeInternalPricingWithTemplate | **隐藏** | ✓ |
| 平台/定价 | snap.ourUnitYuan | 同上 | ✓ | ✓ |
| 平台/扣点 | costPoints | 应付（含税）× 100 兜底 | ✓ | ✓ |
| 平台/用户ID | userId | 同上（兜底） | **隐藏** | ✓ |
| 产品信息（整组 5 列） | 全部空 | 阿里云 CSV 原列透传 | **整组隐藏** | ✓ |

### Round 3 撤销说明（误操作回滚）

上一稿曾把 `tool-web/doc/*.csv` 当作"需要导入的对账数据"跑了 `reconciliation:run`——这是误读。用户原意只是把 CSV 作为**目标展示的参考样例**（"我们希望费用明细呈现成这种格式"），并非要真把云厂商的 170 行流水写进 `ToolBillingDetailLine`。

已通过 `scripts/undo-2026-05-16-csv-import.ts`（一次性脚本，跑完已删）按以下范围回滚：

| 删除对象 | 数量 |
|---|---|
| `ToolBillingDetailLine`（source=CLOUD_CSV_IMPORT） | 170 |
| `BillingReconciliationLine` | 6 |
| `BillingReconciliationRun` | 2 |
| `CloudAccountBinding`（cloudAccountId=1068915519298264 → vic） | 1 |
| 临时脚本：`scripts/ensure-vic-cloud-binding.ts` 与 `scripts/undo-2026-05-16-csv-import.ts` | 2 |

回滚后状态：vic 名下只剩 1 行 `TOOL_USAGE_GENERATED`（reset 后的 ai-fit 真实消费），与 reset 直后预期一致。钱包余额 / 月度订阅 / Round 1+2 的代码改动**全部保留**——只回滚 Round 3 的数据动作。

> 经验教训：若用户提供原始文件且没明说"导入"，先确认意图——尤其涉及"写入财务表"的命令（`reconciliation:run` / 导入 / 补扣），按 `agent-db-and-config-execution` 规则应只在用户明确要求时执行。

## 变更原因总结

| 项目 | 原因 |
|------|------|
| 列表重构 8 组 32 列 | 用户提供 0516.xlsx 模板，要求与阿里云 CSV 同字段名对应；旧 14 组完成度差 |
| 「对内计价/*」6 列删除（cloudRow） | 与 DB `internal*` 7 列重复存储，长期不一致风险 |
| 新增「平台/*」8 列（cloudRow） | 把平台对内（用户ID/系数 M）与对外（产品 Code/名称/计费项 Code/定价/扣点）信息归到同一组 |
| 「应付信息」+「优惠信息」补回 | 财务对账与利润核算的核心字段，删了就**对不上账** |
| 「时长信息」整组删除 | 时长已并入「用量信息」（按秒模型用量单位 = 秒）；保留是冗余 |
| Display 视角过滤 | **v005 Round 2 终版**：user 隐藏 `平台/用户ID + 平台/系数(M)` 与整组「产品信息」；admin 完整可见 |
| **Round 3 误导入回滚** | CSV 是参考样例不是导入数据；删 170 CSV 行 + 2 run + 6 line + 1 binding；保留 vic 1 行 ai-fit |
| 计费数据清零 | 切换列结构涉及 cloudRow JSON 结构改变；保留旧行会让"读 DB 派生新列"逻辑混入历史脏数据 |
| **删除 ToolBillingDetailLine.internal* 7 列（v005 追加）** | v004 已把价格快照固化到 cloudRow JSON「平台/*」键；DB 列变成冗余的"双写"。把所有读端改成从 cloudRow 派生，DB 单一数据源 |


---

## v006 / 2026-05-17 — Round 4：列命名按"谁填"重命名 + 厂商产品 5 列填充 + 计费项Code 收紧

### 背景与决策

用户 Round 3 截图显示费用明细缺少厂商信息：当前 TOOL_USAGE_GENERATED 行的"产品信息/* 5 列"全是空，与 0516.xlsx 模板"借用阿里云字段名作标准词汇表"的初衷不符。深入排查后发现三层问题：

1. **schema 缺字段**：ModelCatalog 只有 canonicalKey/displayName/vendor 3 列内部口径，没有"阿里云口径"的 5 列；
2. **refresh-snapshot bug**：refresh 路径没把 `canonical` 反查结果传给 `buildToolUsageBillingLineData`，导致 cloudRow 永远回退到 toolKey；
3. **列命名歧义**：v004/v005 的列名（"账单信息" "产品信息" "用量信息" ...）混合了"我们填"与"厂商填"两类来源，财务对账时分不清。

经讨论形成 6 项决策（用户已确认）：

1. **Q1 平台/扣点要计算并填入**：`扣点 = 平台定价 × 用量 × 100`，buildCloudRowFromUsage 已在 v004 写入，本轮验证保留；
2. **Q2 优惠/应付 3 列保留**：财务对账核心字段，不能删；
3. **Q3 平台/计费项Code 改 `${toolKey}:${action}`**：与 ToolBillablePrice 唯一键对齐；
4. **Q4 列前缀按"谁填"标注**：「平台 X」= 我们生成 / 「厂商 X」= 云厂商口径（含我们 catalog 反查填的"云字段"）；
5. **Q5 厂商产品 5 列要靠 catalog 反查填**：TOOL_USAGE_GENERATED 行从 `ModelCatalog.vendor*` 5 字段查回（同时支持云 CSV 行直透）；
6. **Q6 系数 M 已设计完善**：`ToolBillablePrice.schemeAAdminRetailMultiplier` 逐工具+逐参考模型独立维护（`learning-pricing-solution.md §5.4`）；当前所有行默认 2.0，admin 可在 `/admin/tool-apps/manage` 修改；本轮把 M 仍保留为 admin-only（不对终端用户暴露商业策略）。

### 列结构（v006 Round 4 终版，9 组 32 列）

| 组 | 列 | 谁填 | 备注 |
|---|---|---|---|
| **平台信息** (8) | 用户ID(admin) · 用户名 · 产品Code · 产品名称 · 计费项Code · 系数(M)(admin) · 定价 · 扣点 | 平台 | 计费项Code 改 `toolKey:action`；系数取 `ToolBillablePrice.schemeAAdminRetailMultiplier` |
| **平台账单** (6) | 账单月份 · 账单日期 · 费用类型 · 消费时间 · 服务开始时间 · 服务结束时间 | 平台 | 与阿里云 CSV 字段名一致 |
| **平台用量** (3) | 抵扣前用量 · 用量 · 用量单位 | 平台 | TOOL_USAGE_GENERATED：抵扣前用量=用量 |
| **厂商产品** (5) | 产品名称 · 商品Code · 商品名称 · 计费项Code · 计费项名称 | 厂商 | 从 ModelCatalog 5 个 vendor* 字段反查 |
| **厂商资源** (1) | 实例ID（出账粒度） | 厂商 | TOOL_USAGE_GENERATED 用 taskId/requestId 兜底 |
| **厂商定价** (4) | 官网目录价 · 价格单位 · 目录价用量阶梯 · 定价币种 | 厂商 | 阶梯当前一律 `[0,9999999999999]` |
| **厂商费用** (2) | 计费公式 · 目录总价 | 厂商 |  |
| **厂商优惠** (2) | 优惠金额 · 优惠详情 | 厂商 | TOOL_USAGE_GENERATED 留空 |
| **厂商应付** (1) | 应付金额（含税） | 厂商 | TOOL_USAGE_GENERATED = 平台扣点折元 |

**Admin-only 白名单**：`平台/用户ID` + `平台/系数(M)` + 整组「厂商产品」对用户隐藏；其余 5 个"厂商 X" 组对用户可见（透明度优先，让用户能看到云目录价 vs 平台定价的差异）。

### 改动清单

| 文件 | 改什么 |
|---|---|
| `prisma/schema.prisma` + 迁移 `20260702120000_model_catalog_vendor_fields` | ModelCatalog 加 5 个 `vendor*` String? 字段 |
| `lib/finance/bill-display-keys.ts` + `finance-web/lib/bill-config.ts` | 列组改名："账单信息"→"平台账单"、"用量信息"→"平台用量"、"产品/资源/定价/费用/优惠/应付/信息"→"厂商X"；`ADMIN_ONLY_GROUPS` 改为 `["厂商产品"]`（其余 5 个"厂商 X" 组用户可见）|
| `lib/finance/tool-usage-billing-line.ts` | `ToolUsageCanonicalHint` 扩展 5 个 `vendor*` 字段；`buildCloudRowFromUsage` 写入新 9 组 32 列；「平台/计费项Code」改 `${toolKey}:${action}` |
| `lib/wallet-record-tool-usage-consume.ts` | `resolveCanonicalFromMeta` 返回 5 个 vendor* 字段 |
| `lib/finance/cloud-bill-enrich.ts` | 加 `ALIYUN_LEGACY_TO_NEW_KEY` 映射表；enrich 时把阿里云 CSV 原 keys（"账单信息/X" "产品信息/X" 等）复制到新 keys（"平台账单/X" "厂商产品/X" 等），CSV 导入路径无需改写 |
| `scripts/billing-refresh-tool-usage-snapshot.ts` | 修 **bug**：补传 `canonical` 参数（同 `recordToolUsageAndConsumeWallet` 反查口径）|
| `scripts/backfill-model-catalog-vendor-fields.ts` | 一次性回填 201 行 ModelCatalog：按 vendor=aliyun × billingKind 默认填 4 列；aitryon/aitryon-plus 单独 override；vendorProductName 全填 "大模型服务平台百炼"|
| `app/admin/finance/usage-overview/page.tsx` | jsonb path 查询从 `产品信息/计费项Code` 改 `平台/计费项Code`；价格读 `厂商定价/官网目录价` 同时兜底旧 key |
| `app/api/account/billing-detail-lines/route.ts` | 加 `source: "TOOL_USAGE_GENERATED"` 过滤——用户端只看自己调用记录，CSV 导入行只 admin 视角对账可见 |
| `finance-web/components/bill-details-client.tsx` | 列 ref 改新 key 名 |

### 数据迁移与回归验证

```bash
# 1) 应用迁移
pnpm db:apply-pending           # 20260702120000_model_catalog_vendor_fields
pnpm db:generate

# 2) 回填 ModelCatalog vendor 5 列（201 行）
pnpm dotenv -e .env.local -- pnpm exec tsx scripts/backfill-model-catalog-vendor-fields.ts

# 3) 重写历史 TOOL_USAGE_GENERATED 行的 cloudRow（含 canonical 命中 + 新 9 组 32 列 key 名）
pnpm dotenv -e .env.local -- pnpm exec tsx scripts/billing-refresh-tool-usage-snapshot.ts
```

回归（vic 1 行 ai-fit 试衣行）验证：

```
平台/产品Code         = "aitryon"
平台/产品名称         = "aitryon · 试衣间"
平台/计费项Code      = "fitting-room__ai-fit:try_on"   ← 新格式
平台/系数(M)         = "2"
平台/定价            = "0.400000"
平台/扣点            = "40"
厂商产品/产品名称     = "大模型服务平台百炼"            ← 新填
厂商产品/商品Code     = "sfm_inference_public_cn"      ← 新填
厂商产品/商品名称     = "百炼大模型推理"                ← 新填
厂商产品/计费项Code   = "image_number"                  ← 新填
厂商产品/计费项名称   = "大模型图片生成量"              ← 新填
厂商定价/官网目录价   = "0.200000"
厂商应付/应付金额(含税) = "0.40"
```

### 维护性设计（用户原话："云厂商的模型会增多, 价格会变动, 云厂商也会增多"）

1. **模型增多** → `backfill-model-catalog-vendor-fields.ts` 按 vendor × billingKind 默认填，新 catalog 重跑即可批量补齐；
2. **价格变动** → 与本轮无关。价格在 `PricingSourceLine`（云成本）和 `ToolBillablePrice`（我方定价）各自的版本/时效线上演进，每次 CSV 导入或 admin 改动都会留版本快照；
3. **厂商增多** → 在 `MAPPINGS_BY_VENDOR` 中新增 `tencent` / `huawei` 分支。当前 ModelCatalog 一对一（1 catalog : 1 primary vendor 映射），若未来同一 canonical 跨多家云并存，再 split 出 `ModelCatalogVendorBinding(1:N)` 表把 5 列迁过去——演进路径已在 schema 注释里写明。

### 已知遗留 / 后续

- `/admin/models/coefficients` 仍是静态占位页（M=2 演示口径）；真正按行编辑 M 在 `/admin/tool-apps/manage` 的 `ToolBillablePrice` 列表里。后续 Round 可考虑把 finance-web 这个页面对接到 book-mall 真实数据。
- 当前所有 catalog 用 `vendor=aliyun` 默认 vendor 5 列填值；admin 任意一行手改后本脚本不会覆盖（脚本只填空值）。
- CSV 导入路径仍透传阿里云原 keys 到 cloudRow JSON，新 keys 由 `enrichCloudRowToFlat` 在展示时投影——CSV 行原始数据可审计，对账逻辑 0 改动。

---

## v007 / 2026-05-17 — Round 5：「厂商费用 / 厂商应付」语义校正

### 背景

用户看完 Round 4 的展示后指出三个问题：

1. **"厂商费用/计费公式" + "厂商费用/目录总价"前两列应该是平台的**——前者公式里有 ×2（系数 M），是平台计算逻辑；
2. **"厂商应付/应付金额（含税）"是用户对平台应付，应叫"应付金额"，归平台组**；
3. **"目录总价"没用**（admin 心算可得，纯冗余）。

### 决策

| 旧列 | 改动 |
|---|---|
| 「厂商费用/计费公式」 | 重命名为「平台/计费公式」（公式含 ×M 系数 → 平台口径）|
| 「厂商费用/目录总价」 | **删除**（admin 心算可得：厂商定价/官网目录价 × 平台用量/用量）|
| 「厂商应付/应付金额（含税）」 | 重命名为「平台/应付金额」（TOOL_USAGE_GENERATED 行 = 用户对平台应付 = 扣点折元；CSV 行 = 平台对云应付，admin 视角靠 source 区分语义）|

最终列结构：**9 组 32 列 → 7 组 31 列**

| 组 | 列数 | 说明 |
|---|---|---|
| **平台信息** | 10 | + 计费公式 + 应付金额（相比 Round 4 增 2） |
| **平台账单** | 6 | 不变 |
| **平台用量** | 3 | 不变 |
| **厂商产品** | 5 | admin-only 整组 |
| **厂商资源** | 1 | 不变 |
| **厂商定价** | 4 | 不变 |
| **厂商优惠** | 2 | 不变（CSV 行对账有用）|
| ~~厂商费用~~ | — | 删除（2 列被拆走/删除）|
| ~~厂商应付~~ | — | 删除（1 列移到平台）|

### 改动清单

| 文件 | 改什么 |
|---|---|
| `lib/finance/bill-display-keys.ts` + `finance-web/lib/bill-config.ts` | 平台信息组 8 列 → 10 列；删除「厂商费用」+「厂商应付」组 |
| `lib/finance/tool-usage-billing-line.ts` | cloudRow JSON 写入「平台/计费公式」+「平台/应付金额」；移除三键写入 |
| `lib/finance/cloud-bill-enrich.ts` | `ALIYUN_LEGACY_TO_NEW_KEY` 调整：CSV「费用信息/计费公式」→「平台/计费公式」；CSV「应付信息/应付金额（含税）」→「平台/应付金额」；删「费用信息/目录总价」映射 |
| `finance-web/components/bill-details-client.tsx` | K_PAYABLE_YUAN 改 `"平台/应付金额"`；头部合计删「云目录总价合计」，改「云应付合计」→「应付金额合计」|

### 数据迁移

```bash
# 重写 TOOL_USAGE_GENERATED 历史行的 cloudRow（用新 key 名 / 删多余 key）
pnpm dotenv -e .env.local -- pnpm exec tsx scripts/billing-refresh-tool-usage-snapshot.ts
```

vic 行验证（重写后）：

```
平台/计费公式         = "0.200000 元/次 × 2 × 1 次 = 0.400000 × 1 = ¥0.40"   ← 含 ×M=2
平台/应付金额         = "0.40"                                                ← 用户对平台应付
平台/扣点             = "40"                                                  ← = 应付金额 × 100
（厂商费用 / 厂商应付 两组的所有 key 已从 cloudRow 中清除）
```

### 语义注解（admin 视角对账）

- TOOL_USAGE_GENERATED 行：「平台/应付金额」= 用户在我们平台支付的金额（= 扣点折元 = 我们的零售收入）；
- CLOUD_CSV_IMPORT 行：「平台/应付金额」= 我们平台对云厂商支付的金额（= 我们的成本支出）；
- admin 对账时把同 `userId × month × canonicalKey` 的两类行加总：差值 = 我们的毛利（不含云端折扣 / 免费额度，那些是平台利润空间）。

### Round 5 hotfix-1 → hotfix-2：用户视角策略来回校准

#### hotfix-1（短暂）
Round 4 默认把整组「厂商产品」设为 admin-only（Round 2 的延续，当时这 5 列全空）。Round 4 把 5 列填上真实内容后，用户在 `/fees/billing/details` 截图反馈"看不到厂商模型那 5 列"。**首次修复**：`ADMIN_ONLY_GROUPS = new Set()`，所有厂商组对用户可见。

#### hotfix-2（最终）
用户当晚又反馈："用户视角全部厂商的都不见，计费公式也不可见"——撤回 hotfix-1，并进一步收紧。

**最终策略**（用户决定）：

- `ADMIN_ONLY_KEYS`（藏单列）：`平台/用户ID` + `平台/系数(M)` + **`平台/计费公式`**（新增——公式含 ×M 系数会透露商业策略，用户只看"定价 / 扣点 / 应付金额"三个结果列即可）
- `ADMIN_ONLY_GROUPS`（藏整组）：`厂商产品` + `厂商资源` + `厂商定价` + `厂商优惠` —— **所有 4 组厂商列对用户整组隐藏**

```diff
 export const ADMIN_ONLY_KEYS: ReadonlySet<string> = new Set([
   "平台/用户ID",
   "平台/系数(M)",
+  "平台/计费公式",
 ]);
- export const ADMIN_ONLY_GROUPS: ReadonlySet<string> = new Set();
+ export const ADMIN_ONLY_GROUPS: ReadonlySet<string> = new Set([
+   "厂商产品",
+   "厂商资源",
+   "厂商定价",
+   "厂商优惠",
+ ]);
```

#### 最终视角矩阵

| 视角 | 列数 | 组数 | 内容 |
|---|---|---|---|
| **用户** (`/fees/billing/details`) | **16** | 3 | 平台信息 7 + 平台账单 6 + 平台用量 3 |
| **管理员** (`/admin/billing/users/<id>`) | **31** | 7 | 全部 |

用户视角的 7 列「平台信息」：用户名 + 产品Code + 产品名称 + 计费项Code + 定价 + 扣点 + 应付金额（藏 用户ID、系数M、计费公式 3 列）。

**设计原则确立**：用户只看"我用了什么 / 用了多少 / 我付了多少"；任何透露成本基线、系数、云内部命名的字段都关到 admin 视角后台。

### Round 5 hotfix-3：用户视角组件层补齐过滤（finance-web）

**问题**：hotfix-2 把"厂商产品/商品名称"整组隐藏后，用户仍在 `/fees/billing/details` 看到「商品名称」**筛选器**与顶部 banner 里 vic 的 cuid——`bill-details-client.tsx` 这两处把字段硬编码，没跟 `ADMIN_ONLY_KEYS / ADMIN_ONLY_GROUPS` 联动。

**修复**（`finance-web/components/bill-details-client.tsx`）：

1. 新增 `canFilterCommodity = visibleKeys.has(K_COMMODITY)`，「商品名称」`BillMultiFilter` 条件渲染；同步在 `filteredRows` 短路 `K_COMMODITY` 的 `matchesMulti`。
2. 顶部 `平台用户：vic (<cuid>)` banner 里的 `<code>{cuid}</code>` 仅在 `effectiveRole === "admin"` 时渲染（与 `ADMIN_ONLY_KEYS["平台/用户ID"]` 同义）。

### Round 5 hotfix-4：扣点透传 cloudBillingKind / billedQty / billedUnit

**问题**：管理端账单详情显示文生图公式 `0.200000 元/次 × 2 × 4 次`——单位「次」是错的，阿里云对 `wanx2.1-t2i-plus`、`aitryon` 的官方口径都是 **元/张、N 张**。

**根因定位**（用 `scripts/inspect-billing-lines.ts` + `inspect-wanx-t2i-plus.ts` 诊断）：

| 层 | 是否正确 |
|---|---|
| 阿里云 CSV 原口径：`元/张` × `4 张` ✓ | OK |
| `ToolBillablePrice.cloudBillingKind`：`OUTPUT_IMAGE`/`COST_PER_IMAGE` ✓ | OK |
| `resolveBillableSnapshot` 返回 `billingKind / billedImageCount` ✓ | OK |
| ✗ `/api/sso/tools/usage/route.ts` 构造 `pricingSnapshot` 时**漏传 3 字段**（`cloudBillingKind / billedQty / billedUnit`） | **bug** |
| ↓ `buildCloudRowFromUsage` 回退到 `billedUnit = "次"` | 表现 |

**修复**：

1. `book-mall/app/api/sso/tools/usage/route.ts`：构造 `pricingSnapshot` 时补 3 字段（`cloudBillingKind` 透传 `snap.billingKind`，`billedQty` 取 `billedImageCount ?? billedVideoSec`，`billedUnit` 按 `cloudBillingKind` 派生「秒/张/千tokens」）。
2. `book-mall/scripts/billing-refresh-tool-usage-snapshot.ts`：同步补齐，保证刷历史行也能写出"张"。
3. 重跑 `billing-refresh-tool-usage-snapshot.ts`，刷新 2 条历史行（vic 1×试衣间 + pp 4×文生图）。

**验证后 cloudRow**：

```
pp / 文生图:   公式 "0.200000 元/张 × 2 × 4 张 = ¥1.60"   厂商定价/价格单位 "元/张"  平台用量/用量 4 张
vic / 试衣间:  公式 "0.200000 元/张 × 2 × 1 张 = ¥0.40"   厂商定价/价格单位 "元/张"  平台用量/用量 1 张
```

**留作复查**：`scripts/inspect-billing-lines.ts` 保留为运营/审计的一次性诊断脚本，列出最近 50 条 `ToolBillingDetailLine` 的关键 cloudRow 字段（产品 / 用量 / 单位 / 公式 / 应付 / 厂商映射）。
