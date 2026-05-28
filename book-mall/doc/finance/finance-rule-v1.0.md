# Finance Rule v1.0 财务规则总则

> 版本：v1.0 · 生效：2026-05-18 · 维护：所有改动财务/计费/钱包逻辑的人
> 本文档是**唯一规则源**：任何代码、运营、客服 SOP 都以本文为准；与本文冲突的代码/历史文档须修复。

## 0. 一图概览（端到端 1 张图）

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  价格源 (B)：tool-web/doc/price_0518.md  ← 云厂商挂牌价（成本价）唯一基线        │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │  pnpm pricing:realign-from-md(:apply)
               ▼
┌──────────────────────────────────┐                  ┌─────────────────────────┐
│  ToolBillablePrice  (D 表)        │ ─── pricing ───▶ │  价格公示 / 个人中心 / 财务管理 │
│  扣点真源（按 toolKey+action+      │                  │  PricingTable + 计价公式     │
│  schemeARefModelKey+cloudTierRaw）│                  └─────────────────────────┘
└──────────────┬───────────────────┘
               │   ≤
               ▼
┌──────────────────────────────────┐
│  tool-web catalog (C)             │ ── reserve 估算（前端 + WalletHold 锁额）
│  tools-scheme-a-catalog.json      │
└──────────────┬───────────────────┘
               │
               ▼
   用户调用工具
   ┌──────────────────────────────────────────────────────────────────────┐
   │ ① start  : POST /api/sso/tools/usage?action=reserve                   │
   │            → reserveWalletHold ×1.2 安全边际，HELD                    │
   │ ② settle : POST /api/sso/tools/usage  body:{durationSec, sr, audio…}  │
   │            → resolveBillableSnapshot 选 D 行 → 真实扣点                │
   │            → 同事务 wallet-=cost / hold→SETTLED / 写 ToolUsageEvent    │
   │            / 写 ToolBillingDetailLine.cloudRow 快照（R）              │
   │ ③ release: 任务失败 → 显式 RELEASED                                   │
   │ ④ expire : cron / opportunistic → HELD 超 TTL 转 EXPIRED               │
   └──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Wallet 账本：balancePoints + frozenPoints                            │
   │  WalletEntry 流水：RECHARGE / CONSUME / REFUND / ADJUST               │
   │  幂等键：tool_usage:{toolKey}:{action}:{taskId}                       │
   └──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  展示：finance-web 单用户 / 全用户 + book-mall /account/billing/      │
   │  数据：ToolBillingDetailLine.cloudRow + applyCanonicalOverlayBatch    │
   └──────────────────────────────────────────────────────────────────────┘
```

---

## 1. 单位与定价公式

### 1.1 单位

| 项 | 值 |
| --- | --- |
| 钱包内部单位 | **点（point）**，1 点 = ¥0.01 |
| 余额字段 | `Wallet.balancePoints`（int，永远整点） |
| 锁额字段 | `Wallet.frozenPoints`（保留字段；当前主要用 `WalletHold` 累加） |
| 币种 | 人民币（CNY），含税口径与挂牌价一致 |
| 区域 | 中国内地 |

### 1.2 唯一定价公式

```
我方挂牌单价(元) = 云厂商挂牌价(成本价) × M
M（retailMultiplier） = 2 （当前约定，保存在 ToolBillablePrice.schemeAAdminRetailMultiplier）
pricePoints = round(我方挂牌单价 × 100)
```

> 这是不变量。任何**与本公式不一致的扣费都是 bug**，必须先在 §15 登记再修。

### 1.3 三类计费维度（与挂牌单位严格一致）

| billingKind | 用量单位 | 实扣公式（点） | 备注 |
| --- | --- | --- | --- |
| `VIDEO_MODEL_SPEC` | 秒 | `round(cost × max(minBilledVideoSec, ⌈durationSec⌉) × M × 100)` | 视频按秒 + 最低秒数兜底 |
| `OUTPUT_IMAGE` / `COST_PER_IMAGE` | 张 | `round(cost × max(minBilledImageCount, imageCount) × M × 100)` | 图片按张 + 最低张数兜底 |
| `TOKEN_IN_OUT` | 次 | `pricePoints`（每次固定，**不按真实 token 动态算**） | 折中：见 §15.3 |

每条最终扣点 ≥ `minChargePointsPerInvoke`（默认 1 点），避免 0 点行。

---

## 2. 数据源四层（B / C / D / R）

| 标签 | 文件 / 表 | 角色 | 谁来维护 |
| --- | --- | --- | --- |
| **B** | `tool-web/doc/price_0518.md` | **唯一基线**（云厂商挂牌价） | 云厂商更新 → 人工 PR 同步 |
| **C** | `tool-web/config/tools-scheme-a-catalog.json` | 工具站本地估算（前端展示 + reserve 锁额估算） | `pnpm pricing:emit-catalogs` / 人工同步 |
| **D** | `ToolBillablePrice`（DB 表） | **真扣点的唯一来源**（settle 时 `resolveBillableSnapshot` 按行查） | `pnpm pricing:realign-from-md(:apply)` |
| **R** | `ToolBillingDetailLine.cloudRow` JSON | 历史快照（用户对账依据 + 财务展示） | `recordToolUsageAndConsumeWallet` 自动写 |

### 2.1 三个不变量（**任何 PR 改财务相关代码都必须保持**）

1. **D = B**：D 表的 `schemeAUnitCostYuan` 必须等于 B 中对应行的挂牌价。偏离 = bug。
2. **C ≥ D**：C 中每个模型/档位的单价必须 **≥** D 的对应单价。否则 reserve 锁的钱小于 settle 实扣 → 出现"先用后欠"漏洞。
3. **M = 2**（当前约定）：D 表 `schemeAAdminRetailMultiplier` = 2。任何例外须在 §15 登记并在管理后台单独调。

### 2.2 D 表行的颗粒度（Scheme B）

每个 `(toolKey, action, schemeARefModelKey, cloudTierRaw)` 组合 **独立一行**。

`cloudTierRaw` 命名规范：

| 模型类 | tierRaw 示例 |
| --- | --- |
| 视频 / 普通分辨率 | `"720P"` / `"1080P"` / `"480P"` / `"360P"` |
| 视频 / wan2.6-flash 这类按音频细分 | `"720P|audio"` / `"720P|silent"` / `"1080P|audio"` / `"1080P|silent"` |
| 图片（按张） | `""`（空） |
| Token | `"无阶梯计价"` / `"0<Token≤32K"` / `"0<Token≤128K"` 等 |

读侧（`resolveBillableSnapshot`）按 `videoTierCandidates(actuals.videoSr, actuals.videoAudio)` 顺序选行：
例如 `sr=1080, audio=true` 优先匹配 `"1080P|audio"`，再 fallback `"1080P"`。

### 2.3 R（cloudRow）写入规范

`ToolBillingDetailLine.cloudRow` 是一份**扁平 key-value JSON**，结构与阿里云 consumedetailbill_v2 同套，加上"平台 8 列"。代码入口：`book-mall/lib/finance/tool-usage-billing-line.ts#buildCloudRowFromUsage`。

固定写入的 4 组键（用户/财务展示都从这里读）：

| 组 | 关键字段 | 必填 |
| --- | --- | --- |
| 平台 | `平台/用户ID`、`平台/用户名`、`平台/产品Code`、`平台/产品名称`、`平台/计费项Code`、`平台/系数(M)`、`平台/定价`、`平台/扣点`、`平台/计费公式`、`平台/应付金额` | 是 |
| 平台账单 | `平台账单/账单月份`、`平台账单/账单日期`、`平台账单/费用类型`、`平台账单/消费时间`、`平台账单/服务开始时间`、`平台账单/服务结束时间` | 是 |
| 平台用量 | `平台用量/抵扣前用量`、`平台用量/用量`、`平台用量/用量单位` | 是 |
| 厂商产品 | `厂商产品/产品名称`、`厂商产品/商品Code`、`厂商产品/商品名称`、`厂商产品/计费项Code`、`厂商产品/计费项名称` | catalog 命中才填，否则空 |
| 厂商资源 | `厂商资源/实例ID（出账粒度）` | 用 `taskId / billingRequestId / modelKey` 兜底 |
| 厂商定价 | `厂商定价/官网目录价`、`厂商定价/价格单位`、`厂商定价/目录价用量阶梯`、`厂商定价/定价币种` | 是 |
| 厂商优惠 | `厂商优惠/优惠金额`、`厂商优惠/优惠详情` | TOOL_USAGE_GENERATED 行留空 |

> **不变量 R-1**：`cloudRow["平台/扣点"] === ToolUsageEvent.costPoints`，且与同事务的 `WalletEntry.amountPoints` 绝对值一致。任何修正必须**同时更新**这三处（见 §7.4 修正凭证）。

---

## 3. 价格导入与对齐流程

### 3.1 标准流程（每次价格变更）

```
① 更新 tool-web/doc/price_0518.md（B）
② cd book-mall
③ pnpm pricing:realign-from-md           # dry-run，确认 diff 与预期一致
④ pnpm pricing:realign-from-md:apply     # 写库 D
⑤ pnpm pricing:inspect-billable-vs-md    # 必须返回 ✅ 全部对齐，否则非 0 退出
⑥ 更新 tool-web/config/tools-scheme-a-catalog.json（C），保证 C ≥ D
⑦ 写当期发布文档（book-mall/doc/releases/YYYY-MM-DD-*.md）
```

### 3.2 PricingSourceVersion 体系（云厂商账单导入 / 留痕）

| 表 | 角色 |
| --- | --- |
| `PricingSourceVersion` | 一次"价目导入"的版本快照（kind: markdown / csv），仅一条 `isCurrent=true` |
| `PricingSourceLine` | 当前版本快照下的每行成本（modelKey + tierRaw + billingKind + 单价 + fingerprint） |
| `PricingLineChangeEvent` | 版本切换时的 diff 事件（changeType = ADDED / REMOVED / CHANGED） |

> 这一层只用于**对账凭据**：D 表（ToolBillablePrice）的 `cloudModelKey + cloudTierRaw + cloudBillingKind` 回链 PricingSourceLine，便于 `pricing:audit-billable-vs-source` 做漂移检查。

### 3.3 npm 脚本速查（在 `book-mall/`）

| 命令 | 用途 |
| --- | --- |
| `pnpm pricing:bootstrap` | 初次建库时把内置 markdown / catalog 灌入 PricingSourceVersion |
| `pnpm pricing:import-markdown` | 从 `tool-web/doc/price.md` 合并导入 TOKEN 行（保留库内非 TOKEN 行） |
| `pnpm pricing:import-csv` | 导入云厂商账单 CSV 作为对账数据源 |
| `pnpm pricing:emit-catalogs` | 由当前 D / PricingSourceLine 反向生成 C（catalog） |
| `pnpm pricing:realign-from-md` / `:apply` | **写 D**：将 D 表与 `price_0518.md` 对齐（按 §2.2 颗粒度建行） |
| `pnpm pricing:inspect-billable-vs-md` | **审计 D**：与 `price_0518.md` 全量比对（CI / 发布前必跑） |
| `pnpm pricing:audit-billable-vs-source` | D 与 PricingSourceLine 一致性检查 |
| `pnpm pricing:verify-billable-formula` | 抽样校验 `pricePoints == round(cost × M × 100)` |
| `pnpm pricing:verify-disclosure-rows` | 校验 `getEffectiveBillablePricesForDisclosure` 实际产出符合预期 |

---

## 4. 扣费三段式：reserve / settle / release / expire

入口：所有工具站走 `POST /api/sso/tools/usage`（`book-mall/app/api/sso/tools/usage/route.ts`），有 4 种 action。

### 4.1 状态机

```
                ┌────────── reserve(start) ──────────┐
                │  estimatedMaxPoints × 1.2 (ceil)   │
                ▼                                    │
              HELD ────────── release(失败) ──────► RELEASED
                │
                │  expiresAt < now （cron / opportunistic）
                └─────────────────────────────────► EXPIRED
                │
                │  settle(成功)：按真实用量重算扣点
                ▼
              SETTLED （写 ToolUsageEvent + WalletEntry + ToolBillingDetailLine）
```

### 4.2 reserve（start 阶段）

代码：`book-mall/lib/wallet-holds.ts#reserveWalletHold`。

```
reservedPoints = ceil(estimatedMaxPoints × SAFETY_MARGIN)   // SAFETY_MARGIN = 1.2
available     = balancePoints − frozenPoints − Σ(其它 HELD 的 reservedPoints)
```

硬门禁（按顺序判断）：

| 条件 | 返回 reason |
| --- | --- |
| `available < reservedPoints` | `insufficient_balance` |
| `available - reservedPoints < watermark` | `below_watermark`（受 `minBalanceLinePoints` 控制） |

通过则 `WalletHold.create({ status: HELD, expiresAt: now + walletHoldDefaultTtlMin·min })`。

幂等：相同 `(userId, taskKey)` 第二次 reserve 直接返回现有 HELD（`reused: true`）。

> 调用方在 reserve 前应**机会主义清理**：每次 reserve 前自动调用 `releaseExpiredHolds()` 把已过期 HELD 转 EXPIRED，避免误锁可用余额。

### 4.3 settle（结算阶段）

代码：`book-mall/lib/wallet-record-tool-usage-consume.ts#recordToolUsageAndConsumeWallet`，**同事务**完成下面 8 件事：

1. 根据 `meta.taskId` 生成幂等键 `tool_usage:{toolKey}:{action}:{taskId}`，命中已存在 `WalletEntry.idempotencyKey` 直接返回 `duplicate`；
2. `resolveCanonicalFromMeta(meta)` 反查 `ModelAlias → ModelCatalog`，得到 canonical `displayName / vendor / vendorProductName / vendorCommodityCode / …`；
3. `resolveUserHint(userId)` 取用户名/邮箱，写 `平台/用户名`；
4. **可用余额硬门禁**（同 §4.2，但 settle 时本次绑定的 `walletHoldId` 不计入"其它 HELD"）；
5. `wallet.updateMany(balancePoints -= costPoints)`，乐观锁防超扣；
6. 写 `ToolUsageEvent`（`costPoints / billedVideoSec / walletHoldId / meta`）；
7. 把绑定的 `WalletHold` 转 `SETTLED`（`settledChargePoints = costPoints`，`settledUsageEventId = ev.id`）；
8. 写 `WalletEntry(type=CONSUME, amountPoints=-costPoints, idempotencyKey)`；
9. 写 `ToolBillingDetailLine.cloudRow`（buildCloudRowFromUsage，固化所有快照）。

`costPoints` 的来源：`resolveBillableSnapshot(toolKey, action, { schemeARefModelKey, actuals })` —— 见 §1.3 公式。`actuals` 包含 `durationSec / imageCount / inputTokens / outputTokens / videoSr / videoAudio`，从 `body.meta` 抽取。

### 4.4 release（失败显式释放）

代码：`releaseWalletHold({ holdId | (userId, taskKey) })`。

- HELD → RELEASED（写 `releaseReason`）；
- 已 SETTLED → 返回 `already_settled`（不会回退余额）；
- 已 RELEASED / EXPIRED → 返回 `alreadyReleased: true`（幂等）。

调用入口（必须显式释放）：

| 工具 | 失败回调位置 |
| --- | --- |
| 文生图 / 图生视频 / 文生视频 | `tool-web/app/api/{text-to-image, image-to-video}/start/route.ts` 失败分支 |
| 通用 | `tool-web/app/api/image-to-video/release-hold/route.ts` |

### 4.5 expire（自动兜底）

| 路径 | 触发 |
| --- | --- |
| Vercel cron | `book-mall/vercel.json` 配置 5 分钟一次 → `GET /api/admin/wallet-holds/expire` |
| 机会主义清理 | 每次 `reserveWalletHold` 入口先 `releaseExpiredHolds()` |
| 兜底脚本 | 非 Vercel 部署用 `pnpm wallet-holds:expire`（systemd timer / cron） |

`releaseExpiredHolds(now)` 把 `status=HELD AND expiresAt < now` 的 hold 批量更新为 `status=EXPIRED, releaseReason='ttl_expired'`。

### 4.6 关键不变量

- **HELD → SETTLED 必须在同事务内**完成钱包扣减 + ToolUsageEvent 写入；任一失败则整体回滚。
- **绝不允许直接修改 `Wallet.balancePoints`**：必须经 `recordToolUsageAndConsumeWallet`、`adjustUserWallet` 等带 `WalletEntry` 流水的封装。
- 同一 `taskKey` **永远只允许一个 HELD**（schema 上 `(userId, taskKey)` 唯一）。
- settle 时 `costPoints` 可以小于、等于、**也可以大于** `WalletHold.reservedPoints`（多扣场景：实际用量超估算 × 1.2）；只要 `available − costPoints ≥ watermark` 就允许。**这是 reserve 不能彻底防超扣的原因**——必须配合用户日常充值与水位线策略。

---

## 5. 水位线、兜底与安全边际（PlatformConfig 单行）

所有阈值集中在 `PlatformConfig`（`id="default"` 单行），可在管理后台调。

| 字段 | 默认 | 含义 | 在哪里生效 |
| --- | --- | --- | --- |
| `minBalanceLinePoints` | 2000（¥20） | **准入水位线**：可用余额必须 ≥ 此值才能 reserve / settle | `reserveWalletHold`、`recordToolUsageAndConsumeWallet` |
| `balanceWarnHighPoints` | 5000（¥50） | 前端绿/黄分界（低于即橙色提示） | 个人中心余额条 |
| `balanceWarnMidPoints` | 3000（¥30） | 前端黄/红分界（低于即红色提示） | 个人中心余额条 |
| `minBilledVideoSec` | 5 | 视频按秒计费的最低秒数兜底 | `computeChargePointsFromActuals` |
| `minBilledImageCount` | 1 | 图片按张计费的最低张数兜底 | `computeChargePointsFromActuals` |
| `minChargePointsPerInvoke` | 1 | 单次调用最低 1 点（避免 0 点行） | `computeChargePointsFromActuals` |
| `walletHoldDefaultTtlMin` | **10** | WalletHold 默认 TTL（分钟）；v005（2026-05-18）从 30 → 10 | `reserveWalletHold` 入口 |
| `usageAnomalyRatioPercent` | 300（=3×） | 异常消耗告警阈值（占位） | 监控（暂未启用） |
| `llmInputPer1kTokensPoints` / `llmOutputPer1kTokensPoints` | 0 | LLM 按千 token 计价占位（当前未启用，详见 §15.3） | — |
| `toolInvokePerCallPoints` | 0 | 高阶工具单次默认扣点占位 | — |

### 5.1 安全边际（reserve）

```
SAFETY_MARGIN = 1.2 （硬编码于 lib/wallet-holds.ts）
reservedPoints = ceil(estimatedMaxPoints × SAFETY_MARGIN)
```

- `estimatedMaxPoints` 由调用方按"该工具/模型/档位的最大可能用量 × M × 100"算（见 `tool-web/app/api/.../start/route.ts`）。
- 视频按 **最大可能秒数**（如 happyhorse 默认 10s 上限）+ 最高分辨率档计算，宁多锁不少锁。

### 5.2 三种"上限"含义不要混淆

| 名称 | 含义 | 是否硬限 |
| --- | --- | --- |
| **最低扣费线** | `minBilledVideoSec / minBilledImageCount / minChargePointsPerInvoke`，决定单条扣点不低于某阈值 | 是 |
| **最高扣费线** | **不存在**——上限通过 reserve × 1.2 + settle 真实用量两段实现 | 否 |
| **水位线** | `minBalanceLinePoints`，余额低于此值禁止新调用 | 是 |
| **预警线** | `balanceWarnHigh/MidPoints`，仅前端颜色提示 | 否 |

---

## 6. 历史快照（cloudRow）—— 真账依据

每条工具调用扣费**必有一条** `ToolBillingDetailLine`（`source = TOOL_USAGE_GENERATED`），cloudRow JSON 是 **R 层**（见 §2）。

### 6.1 写入规则

- 由 `recordToolUsageAndConsumeWallet` 同事务写入；
- canonical 反查在事务前完成（避免 N+1）；
- `平台/扣点` / `平台/应付金额` / `平台/计费公式` 三列**互锁**（同一 costPoints 推导）。

### 6.2 不可变性 + 修正凭证（**关键规则**）

> 历史 cloudRow 一经写入即视为"真账"。不允许覆盖式修改。**唯一修正路径**：在 cloudRow 中追加 `adjustment` 子对象 + 同步更新 4 个展示字段。

修正凭证标准结构（`book-mall/scripts/refund-overcharge-2026-05-18.ts` 的标准做法）：

```jsonc
{
  "...原 cloudRow 所有字段...": "...",
  "平台/扣点": "1600",            // 修正后值（以"修正后"为准）
  "平台/应付金额": "16.00",       // 同步
  "平台/定价": "3.200000",        // 同步
  "平台/计费公式": "0.900000 元/秒 × 2 × 5 秒 = 1.800000 × 5 = ¥16.00",
  "adjustment": {
    "type": "overcharge_refund",
    "ticket": "<内部工单号>",
    "operatorUserId": "<管理员 userId>",
    "decidedAt": "2026-05-18T03:00:00.000Z",
    "snapshotBefore": {
      "平台/扣点": "4500",
      "平台/应付金额": "45.00",
      "平台/定价": "9.000000",
      "平台/计费公式": "<原公式>"
    },
    "refundEntryId": "<对应 WalletEntry.id>",
    "note": "happyhorse-1.0-i2v 1080P 5 秒 误填成本价 4.5 元/秒（应 1.6）。"
  }
}
```

同时必须有一条 `WalletEntry { type: ADJUST, amountPoints: +(原扣点 - 修正后扣点), idempotencyKey: 'refund:<eventId>' }`（**正数**，回血给用户）。

### 6.3 修正脚本规范

- 一次修正对应一份 `book-mall/scripts/refund-<topic>-<date>.ts`，**永远幂等**（按 `WalletEntry.idempotencyKey` 去重）；
- 脚本必须同时：① 写 `WalletEntry(ADJUST)`；② 修正 `ToolUsageEvent.costPoints`（如需）；③ 修正 `ToolBillingDetailLine.cloudRow`；
- 修复完跑 `book-mall/scripts/verify-bill-row-after-patch.ts`（按需新建一个 `verify-<topic>.ts`）走 `enrichBillingLineToFlatRow + applyCanonicalOverlayBatch`，断言展示字段已正确。

---

## 7. 钱包账本（Wallet / WalletEntry / WalletHold）

### 7.1 表关系

```
User 1 ── 1 Wallet 1 ── N WalletEntry  (流水：唯一可信来源)
User 1 ── N WalletHold (in-flight 预占用，不影响 balancePoints，影响"可用余额")
```

### 7.2 流水类型（WalletEntryType）

| type | 方向 | 典型来源 | 幂等键示例 |
| --- | --- | --- | --- |
| `RECHARGE` | + | 充值订单回调 / mock 收银 | `recharge:order:<orderId>` |
| `CONSUME` | − | 工具站扣费 settle | `tool_usage:<toolKey>:<action>:<taskId>` |
| `REFUND` | + | 提现 / 订阅退款 | `refund:wallet:<refundRequestId>` 或 `refund:subscription:<id>` |
| `ADJUST` | ±  | 客服补偿 / 误扣修正 / 充送优惠券核销 bonus | `adjust:<topic>:<eventId>` |

### 7.3 余额三个口径

| 口径 | 公式 | 用途 |
| --- | --- | --- |
| 账面余额 | `Wallet.balancePoints` | 用户可见、UI 大数字 |
| 可用余额 | `balancePoints − frozenPoints − Σ(WalletHold WHERE status=HELD).reservedPoints` | reserve / settle 硬门禁 |
| 可提现余额 | 由 `WalletRefundRequest` 流程后台核算（含订阅政策、未结算用量回扣） | 提现申请 |

### 7.4 幂等键命名规范（**强制**）

| 业务 | 前缀 | 完整示例 |
| --- | --- | --- |
| 工具调用扣点 | `tool_usage:` | `tool_usage:image-to-video:settle:abc123` |
| 充值入账 | `recharge:order:` | `recharge:order:cl_xxx` |
| 充送 bonus 入账 | `adjust:bonus:coupon:` | `adjust:bonus:coupon:<UserRechargeCoupon.id>` |
| 误扣修正 | `adjust:refund:<topic>:` | `adjust:refund:happyhorse-overcharge:<eventId>` |
| 余额提现 | `refund:wallet:` | `refund:wallet:<WalletRefundRequest.id>` |
| 订阅退款 | `refund:subscription:` | `refund:subscription:<SubscriptionRefundRequest.id>` |

> 所有"会动余额"的代码路径必须先生成幂等键再写 `WalletEntry`；命中 `findUnique({where:{idempotencyKey}})` 直接返回 duplicate。**禁止**写没有幂等键的 `WalletEntry`（除非是历史一次性脚本，需在 §15 登记）。

---

## 8. 用户视角 · 个人中心

### 8.1 入口

| 页面 | 路径 | 数据来源 |
| --- | --- | --- |
| 个人中心 / 价格说明 | `book-mall` `/account/pricing` | `getPricingTableRowsForDisclosure()`（共享） |
| 个人中心 / 财务控制台账单详情 | `finance-web` `/account/billing/details` | `book-mall` `/api/account/billing-detail-lines` |
| 公开价格公示 | `book-mall` `/pricing-disclosure` | 同 8.1 第一行（共享 `PricingTable`） |

> §11 的"价格公示统一组件"一节会展开。

### 8.2 单用户费用明细 API

`GET /api/account/billing-detail-lines`（`book-mall/app/api/account/billing-detail-lines/route.ts`）

| 项 | 说明 |
| --- | --- |
| 鉴权 | NextAuth Cookie；本地开发可 `FINANCE_ALLOW_DEV_USER_QUERY=1` + `?devUserId=` |
| 范围 | `where: { userId: viewer, source: 'TOOL_USAGE_GENERATED' }`（**仅本人 + 仅工具站行**） |
| 返回 | `{ source, user, balancePoints, rows, viewer }` |
| 加工 | `enrichBillingLineToFlatRow` → `applyCanonicalOverlayBatch`（用 ModelCatalog 把"产品名 / 商品名 / 规格"覆写为 canonical） |

### 8.3 用户视角列（finance-web `BillDetailsClient`）

用户视角隐藏所有 `厂商/*` 列（避免泄漏成本价格细节），保留：

- 平台 8 列（用户ID / 用户名 / 产品Code / 产品名称 / 计费项Code / 系数(M) / 定价 / 扣点）
- 平台/计费公式 + 平台/应付金额
- 平台账单 6 列
- 平台用量 3 列

页面顶部 4 个汇总卡片：

```
余额        ¥(balancePoints/100)
扣点合计     ¥(Σ 平台/扣点)/100
应付金额合计  Σ 平台/应付金额
余额 − 扣点  上面两者相减（健康度）
```

---

## 9. 管理员视角 · 财务管理端（finance-web）

### 9.1 侧栏入口（`finance-web/components/admin-sidebar.tsx`）

| 菜单 | 路径 | 用途 |
| --- | --- | --- |
| 财务总览 | `/admin` | 仪表盘（卡片入口聚合） |
| 用户与钱包 | `/admin/users` | 用户清单、钱包余额、订阅状态 |
| 单用户费用明细 | `/admin/billing/users/[userId]` | 进入某用户的明细（同 §8 列 + 厂商列 + 调整凭证） |
| **费用明细（全部）** | `/admin/billing/all` | 汇总所有用户明细 |
| 在库价目 | `/admin/finance/cloud-pricing` | 仅"导入版本"管理 |
| **价格公示** | `/admin/pricing-disclosure` | 链接卡片到 `book-mall` 公示页 / 个人中心价目页 |
| 钱包流水 | `/admin/wallet/entries` | `WalletEntry` 全量查询 |
| 提现 / 退款 | `/admin/refunds` | `WalletRefundRequest` / `SubscriptionRefundRequest` 处理 |

### 9.2 全用户费用明细 API（新）

`GET /api/admin/finance/billing-detail-lines-all`（`book-mall/app/api/admin/finance/billing-detail-lines-all/route.ts`）

| 项 | 说明 |
| --- | --- |
| 鉴权 | book-mall NextAuth Cookie + `role === 'ADMIN'` |
| 查询参数 | `from / to`（ISO 时间，可选）、`userId`（精确匹配，可选）、`take`（默认 1000，max 5000） |
| 返回 | `{ rows, total, returned, take, truncated, filter, source: 'book-mall-admin-all' }` |
| 加工 | 同 §8.2（enrich + canonical overlay） |

### 9.3 单用户费用明细 API（已有）

`GET /api/admin/finance/billing-detail-lines?userId=<id>` —— 用于进入某具体用户。

### 9.4 管理员视角列

`BillDetailsClient` 在 `viewerRole='admin'` 时**展示全部 7 组 31 列**（含厂商定价 / 厂商产品 / 厂商资源 / 厂商优惠），并在某行存在 `cloudRow.adjustment` 时显示"已调整"徽章 + 悬浮提示 `snapshotBefore`。

`mode='all-users'` 时隐藏的元素：
- 顶部用户提示卡（"非本人请勿展示"等）
- 远程 user 详情卡
- 钱包余额卡

---

## 10. 价格公示页 — 一份组件三处复用

### 10.1 三个入口（**同一份数据 + 同一份组件**）

| 路径 | 受众 | 鉴权 |
| --- | --- | --- |
| `book-mall` `/pricing-disclosure` | 公开（任何人） | 无 |
| `book-mall` `/account/pricing` | 登录用户（个人中心） | NextAuth |
| `finance-web` `/admin/pricing-disclosure` | 管理员（仅链接 + 说明） | NextAuth + ADMIN |

### 10.2 数据 / 组件来源

- 数据：`book-mall/lib/pricing-disclosure.ts#getPricingTableRowsForDisclosure()`
  - 输入：当前 `ToolBillablePrice` `active=true` 行 + `ModelCatalog` 反查
  - 去重键：`(toolKey, action, schemeARefModelKey, cloudTierRaw)`
  - 输出每行：`{ toolLabel, action, actionLabel, schemeARefModelKey, cloudTierRaw, billingKind, unitLabel, formulaText, pricePoints, schemeAUnitCostYuan, retailMultiplier, vendor, vendorProductName, vendorCommodityName, modelDisplayName }`
- 组件：
  - `book-mall/components/pricing/pricing-table.tsx`（共享表）
  - `book-mall/components/pricing/pricing-formula-card.tsx`（公式说明卡）

### 10.3 表格列（与"图1"对齐 + "图3"补全）

```
工具 | 模型(canonical) | 档位/规格 | 计费维度 | 我方单价(¥) |
云厂商挂牌价(成本价) | 系数 M | 厂商产品 | 厂商商品 | 厂商计费项 | 公式
```

### 10.4 校验

```
pnpm pricing:verify-disclosure-rows
```
保证 `getEffectiveBillablePricesForDisclosure` 返回的行与 D 表 / `price_0518.md` 完全一致。

---

## 11. 充值 / 订阅 / 退款（关联流程）

### 11.1 充值（`Order(type=WALLET_TOPUP)` → `WalletEntry(RECHARGE)`）

```
用户下单 (Order PENDING)
  ├─ 真实支付：成功回调 → Order PAID → walletEntry RECHARGE +
  └─ Mock 收银 (ALLOW_MOCK_PAYMENT=1)：AWAITING_MOCK_CONFIRM → 管理员确认 → 同上
```

幂等键：`recharge:order:<orderId>`。

### 11.2 充送优惠券（`RechargePromoTemplate` / `UserRechargeCoupon`）

| 表 | 关键字段 |
| --- | --- |
| `RechargePromoTemplate` | `paidAmountPoints`（实付门槛）、`bonusPoints`（赠送）、`claimableFrom/To`、`validDaysAfterClaim`、`maxClaimsPerUser` |
| `UserRechargeCoupon` | `status`（UNUSED → REDEEMED / EXPIRED）、`paidAmountPointsSnap`、`bonusPointsSnap`（领取时快照）、`expiresAt`、`orderId`（核销绑定） |

核销时一次写两条 `WalletEntry`：① RECHARGE（实付） ② ADJUST（bonus）；分开统计便于"是否抵扣"分流（详见 `doc/product/points-wallet-topup-spec.md`）。

### 11.3 订阅（`SubscriptionPlan` / `Subscription`）

| 项 | 规则 |
| --- | --- |
| 价格不可改 | 改 plan = 旧 plan archive + 新 plan 上线（同 slug 新 id），老 Subscription 仍指向归档 plan |
| 工具范围 | `toolsNavAllowlist` 决定订阅期内可用的工具分组 |
| 与扣点关系 | **订阅不抵扣工具站扣点**——订阅只决定"能否进入工具"；进入后所有调用仍按 `ToolBillablePrice` 扣 Wallet 余额 |

### 11.4 退款 / 提现

| 表 | 流程 |
| --- | --- |
| `WalletRefundRequest` | 用户申请 → 后台核算"应扣未扣 + 实际可提现" → COMPLETED：写 WalletEntry(REFUND, -amount) + 记 `refundAmountPoints` |
| `SubscriptionRefundRequest` | 政策独立于余额提现；COMPLETED 时根据剩余天数等比例退（具体策略见 `doc/process/real-payment-integration.md`） |

幂等键见 §7.4。

### 11.5 关键不变量

- **订阅与扣点解耦**：黄金会员/全模态会员**仅放权**进入工具，**不**预付/抵扣 ToolBillablePrice 扣点。
- 任何"赠送点"必须以 `WalletEntry(ADJUST, +bonus)` 记录，且**带幂等键**。
- 所有充值/退款/订阅退款回调必须**幂等**，重复回调不得重复记账。

---

## 12. 数据库表速查

> 完整 schema 见 `book-mall/prisma/schema.prisma`。下表只列**财务相关**模型与关键字段，所有变动须先在 `book-mall/doc/database/schema-changelog.md` 登记。

### 12.1 钱包域

| 模型 | 关键字段 | 说明 |
| --- | --- | --- |
| `Wallet` | `userId(@unique) balancePoints frozenPoints currency` | 1 用户 1 钱包；不允许直接 update balancePoints |
| `WalletEntry` | `walletId type amountPoints balanceAfterPoints idempotencyKey orderId description createdAt` | **唯一可信流水**；`type ∈ RECHARGE/CONSUME/REFUND/ADJUST`；`idempotencyKey @unique` |
| `WalletHold` | `userId toolKey action reservedPoints status taskKey meta expiresAt settledChargePoints settledUsageEventId releaseReason` | 4 状态：HELD / SETTLED / RELEASED / EXPIRED；`(userId, taskKey)` 唯一 |
| `WalletRefundRequest` | `userId status requestedAmountPoints pendingSettlementPoints refundAmountPoints userNote adminNote decidedAt` | 余额提现申请 |

### 12.2 计量与计费域

| 模型 | 关键字段 | 说明 |
| --- | --- | --- |
| `ToolUsageEvent` | `userId toolKey action meta costPoints billedVideoSec walletHoldId createdAt` | 单次工具调用事件（页面浏览也用，扣点的 costPoints>0） |
| `ToolBillingDetailLine` | `userId source toolUsageEventId cloudRow pricingTemplateKey createdAt` | 财务明细 R 层；source ∈ `TOOL_USAGE_GENERATED` / `CLOUD_CSV_IMPORT` |
| `ToolBillablePrice` | `toolKey action pricePoints effectiveFrom effectiveTo active schemeARefModelKey schemeAUnitCostYuan schemeAAdminRetailMultiplier cloudModelKey cloudTierRaw cloudBillingKind` | **D 表**——扣点真源 |
| `PlatformConfig` | 见 §5 全表 | 单行 `id="default"` |

### 12.3 价目导入域

| 模型 | 关键字段 | 说明 |
| --- | --- | --- |
| `PricingSourceVersion` | `kind sourceSha256 regionScope label importedAt isCurrent rowCount parseWarnings` | 一次导入的版本快照；isCurrent 仅一条 |
| `PricingSourceLine` | `versionId sectionH2 sectionH3 modelKey modelLabelRaw tierRaw billingKind inputYuanPerMillion outputYuanPerMillion costJson fingerprint sourceLine effectiveDiscount effectivePromoNote effectiveCapturedAt` | 当前快照下的成本行 |
| `PricingLineChangeEvent` | `fromVersionId toVersionId modelKey tierRaw billingKind changeType oldSnapshot newSnapshot` | 版本切换 diff（ADDED/REMOVED/CHANGED） |
| `ModelCatalog` | `canonicalKey displayName vendor defaultTierRaw billingKind unitLabel vendorProductName vendorCommodityCode vendorCommodityName vendorBillableItemCode vendorBillableItemName active note` | 标准模型 + 厂商账单 5 列映射 |
| `ModelAlias` | `catalogId source aliasValue tierRawHint confidence matchedBy evidence active` | 别名→catalog 反查；source ∈ `INTERNAL_SCHEME_A_MODEL` 等 |
| `CloudAccountBinding` | `cloudAccountId cloudAccountName userId note` | 云厂商账户 ID → 平台 User 绑定（CSV 导入归属判定） |

### 12.4 订阅 / 充值 / 优惠券域

| 模型 | 关键字段 | 说明 |
| --- | --- | --- |
| `SubscriptionPlan` | `slug name interval pricePoints active toolsNavAllowlist archivedAt parentPlanId` | 价不可改 → 谱系机制 |
| `Subscription` | `userId planId status currentPeriodStart currentPeriodEnd cancelAtPeriodEnd` | 状态 ACTIVE / CANCELLED / EXPIRED |
| `Order` | `userId type status amountPoints currency meta paidAt refundedAt` | type ∈ SUBSCRIPTION / WALLET_TOPUP / PRODUCT_SUBSCRIPTION |
| `RechargePromoTemplate` | `slug title paidAmountPoints bonusPoints claimableFrom/To validDaysAfterClaim maxClaimsPerUser` | 充送优惠券模板 |
| `UserRechargeCoupon` | `userId templateId status paidAmountPointsSnap bonusPointsSnap titleSnap templateSlugSnap claimedAt expiresAt redeemedAt orderId` | 用户领取/核销快照 |
| `SubscriptionRefundRequest` | `userId orderId subscriptionId status userReason adminNote decidedAt` | 订阅退款审核 |

---

## 13. 用户问题排查 SOP

### 13.1 用户报"扣多了 / 不对"

```
1. 拿到 用户邮箱 + 调用时间区间（精确到分钟）
2. SELECT * FROM "ToolUsageEvent" WHERE "userId"=? AND "createdAt" BETWEEN ? AND ?
   → 拿到 eventId
3. SELECT * FROM "ToolBillingDetailLine" WHERE "toolUsageEventId"=eventId
   → 看 cloudRow 内：
        - "平台/扣点" / "平台/应付金额" / "平台/计费公式"
        - "平台用量/用量" / "用量单位"
        - "厂商定价/官网目录价" / "平台/系数(M)"
        - 是否有 adjustment 字段（是否已修正）
4. 拿同 modelKey + tierRaw 去 price_0518.md（B）核对挂牌价；再去 ToolBillablePrice（D）核对：
        - schemeAUnitCostYuan == B
        - schemeAAdminRetailMultiplier == 2
        - pricePoints == round(cost × 2 × 100)
5. 三方对得上 → 用户感受偏差（解释/不退款）
   三方对不上 → §13.2 走补偿流程
```

### 13.2 补偿流程

```
1. 在 §15 "已知偏差登记" 登一条（含 affected_user_count / refund_total_yuan）
2. 写一份脚本 book-mall/scripts/refund-<topic>-<date>.ts
   - WalletEntry(ADJUST, +amount, idempotencyKey='adjust:refund:<topic>:<eventId>')
   - 同步 ToolBillingDetailLine.cloudRow（按 §6.2 修正凭证规范写 adjustment + 4 个展示字段）
   - 同步 ToolUsageEvent.costPoints（如需）
3. 跑 verify-bill-row-after-patch.ts 断言展示无误
4. 修根因（D 表 / catalog C / 计费代码），并跑 pricing:inspect-billable-vs-md
5. 写发布文档（book-mall/doc/releases/）
```

### 13.3 用户报"我充了钱没到账 / 看不到订阅权限"

- 充值：先看 `Order` 状态；再看 `WalletEntry(type=RECHARGE, idempotencyKey='recharge:order:<orderId>')` 是否存在；
- 订阅：看 `Subscription.currentPeriodEnd`；订阅入口的"是否准入"取决于 `Subscription.status=ACTIVE` + `plan.toolsNavAllowlist` 包含目标 navKey。

---

## 14. 跨服务边界 / 安全约束

| 项 | 规则 |
| --- | --- |
| 鉴权 | 所有 `/api/account/*` 必须 NextAuth Cookie 验证；所有 `/api/admin/*` 必须 `role === 'ADMIN'` |
| 跨域 | finance-web 调 book-mall 必须带 `credentials: 'include'`；book-mall 用 `financeCorsHeaders(request)` 白名单 origin |
| 缓存 | 所有费用明细 API 返回 `Cache-Control: private, no-store`（`billingPrivateCacheHeaders`）防代理缓存 |
| 越权 | `/api/account/billing-detail-lines` 返回前**双保险过滤** `lines.filter(l => l.userId === viewerId)`，避免 ORM/数据异常导致越权 |
| 工具站 SSO | `/api/sso/tools/usage` 用 Bearer / SSO JWT 鉴权（`requireToolsJwtSecret`），永不暴露 NextAuth |
| dev fallback | `FINANCE_ALLOW_DEV_USER_QUERY=1 + ?devUserId=` 仅 `NODE_ENV !== 'production'` 时生效 |

---

## 15. 已知偏差与产品取舍登记

> 格式：`YYYY-MM-DD · 偏差描述 · 影响 · 状态`

### 15.1 2026-05-18

- ✅ **D 表视频模型 cost 与挂牌严重不符**：happyhorse 系列 D 表填 4.5 元/秒（应 720P 0.9 / 1080P 1.6），导致 1080P 5 秒扣 ¥45 而非 ¥16。
  影响：`liu_price168@126.com` 1 单 ¥29 过扣。
  状态：已修复（`pricing-realign-from-price-md.ts --apply` 重生成 50+ 行视频价目）+ 受影响用户已通过 `refund-overcharge-2026-05-18.ts` 退还 + cloudRow 已补 `adjustment.snapshotBefore`。
- ✅ **D 表无 cloudTierRaw 区分档位**：所有视频只有单行 + tier=""，720P / 1080P 同价。
  状态：已按档位拆行 + `resolveBillableSnapshot` 按 sr 选行（v004 `videoTierCandidates`）。
- ✅ **catalog C happyhorse `flatYuanPerSecond: 0.9`**：1080P reserve 锁额 < settle 实扣（1.6）。
  状态：C 改 `bySr`。
- ⚠️ **wan2.6-flash audio 维度的 hold reserve**：D 已按 audio/silent 拆 4 行；C 也按 `bySrAudio` 拆，但 reserve 阶段 catalog C 路径不传 audio（默认 audio:true 估算）。
  状态：可接受（保守锁高价，settle 时按真实 audio 退差额）。
- ℹ️ **Token 类按次固定扣点（§1.3）**：与"按真实 token × 挂牌"不一致；产品取舍，避免每次扣点波动。
  未来切换需：① schema 拆 `inputUnitYuan / outputUnitYuan`；② settle 真实读 `inputTokens/outputTokens` 算点；③ catalog C 同步改为按 token 估算。

### 15.2 历史

- 2026-05-16 · 引入按秒计费 + WalletHold 机制 · 详见 `book-mall/doc/releases/2026-05-16-per-second-billing-and-model-calibration.md`。
- 2026-05-16 · 订阅版本谱系（停旧发新 · 价不可改）· 详见 `2026-05-16-subscription-plan-lineage.md`。

### 15.3 待办（已知未实现）

- [ ] **真实按 token 扣费**：见 §15.1 ℹ️。
- [ ] **价格变更通知用户**：当前价格变更不会主动通知现有用户，仅在公示页可见。
- [ ] **数据保留期 / 归档策略**：`ToolUsageEvent`、`ToolBillingDetailLine`、`WalletEntry` 当前永久保留；尚无清理 / 归档策略。
- [ ] **用户侧导出明细 CSV**：finance-web 当前仅页面表格，无导出按钮。管理端 `usage-overview-export-button.tsx` 已支持。
- [ ] **按 toolKey 维度的异常告警**：`PlatformConfig.usageAnomalyRatioPercent` 已存字段未启用。
- [ ] **管理操作审计日志**：管理员对 D 表 / 用户钱包的写操作目前无单独审计表（仅靠 git + WalletEntry 流水）。
- [ ] **`Wallet.frozenPoints` 用法统一**：当前主要用 `WalletHold.reservedPoints` 管 in-flight；`frozenPoints` 仅订阅相关流程偶用，建议长期合并到 `WalletHold` 模型。

---

## 16. 不变量速查（**任何 PR 改财务都必须保持**）

1. **公式**：`pricePoints = round(cost × M × 100)`，M=2（除非 §15 登记例外）。
2. **D = B**：ToolBillablePrice.schemeAUnitCostYuan = price_0518.md 对应行挂牌价。
3. **C ≥ D**：catalog 任意行单价 ≥ 对应 D 行单价（保护 reserve 不被 settle 反超）。
4. **三方一致**：`cloudRow["平台/扣点"] === ToolUsageEvent.costPoints === |WalletEntry.amountPoints|`。
5. **同事务**：`reserve→settle` 必须**同事务**完成 `wallet.balancePoints -= cost` + `walletHold.status = SETTLED` + `WalletEntry` + `ToolUsageEvent` + `ToolBillingDetailLine`，否则整体回滚。
6. **唯一 HELD**：`(userId, taskKey)` 在任意时刻最多一个 HELD（DB unique 保证）。
7. **幂等键必填**：所有写 `WalletEntry` 的代码路径必须带前缀化的 idempotencyKey（§7.4），重复回调命中即直接返回 duplicate。
8. **历史不可变**：cloudRow 任何修正必走 `adjustment.snapshotBefore` 凭证（§6.2）。
9. **越权双保险**：`/api/account/*` 在 `where: { userId: viewer }` 之上还要在序列化前 `filter(l => l.userId === viewer)`。
10. **水位线先行**：reserve 在余额校验之外还须保证 `available − reservedPoints ≥ minBalanceLinePoints`（"用完了再充"被禁止）。

---

## 17. 相关文件 / 命令速查

### 17.1 代码

| 文件 / 路径 | 作用 |
| --- | --- |
| `tool-web/doc/price_0518.md` | **B**：唯一基线 |
| `tool-web/config/tools-scheme-a-catalog.json` | **C**：reserve / 前端估算 |
| `book-mall/lib/tool-billable-price.ts` | **D 读侧**：`resolveBillableSnapshot` |
| `book-mall/lib/wallet-holds.ts` | reserve / release / expire |
| `book-mall/lib/wallet-record-tool-usage-consume.ts` | **settle 主体**（同事务） |
| `book-mall/lib/finance/tool-usage-billing-line.ts` | cloudRow 拼装（R 写侧） |
| `book-mall/lib/finance/cloud-bill-enrich.ts` | 把 `ToolBillingDetailLine` 投影成扁平 row |
| `book-mall/lib/finance/canonical-bill-overlay.ts` | 用 ModelCatalog 覆写产品/商品/规格列 |
| `book-mall/lib/pricing-disclosure.ts` | 公示页/个人中心数据来源 |
| `book-mall/components/pricing/pricing-table.tsx` | 共享表格组件 |
| `book-mall/components/pricing/pricing-formula-card.tsx` | 公式卡片 |
| `book-mall/app/api/sso/tools/usage/route.ts` | reserve / settle / release / report 统一入口 |
| `book-mall/app/api/account/billing-detail-lines/route.ts` | 用户单人明细 |
| `book-mall/app/api/admin/finance/billing-detail-lines/route.ts` | 管理端单用户明细 |
| `book-mall/app/api/admin/finance/billing-detail-lines-all/route.ts` | 管理端全用户明细 |
| `book-mall/app/api/admin/wallet-holds/expire/route.ts` | cron endpoint |
| `book-mall/app/(site)/pricing-disclosure/page.tsx` | 公示页 |
| `book-mall/app/(account)/account/pricing/page.tsx` | 个人中心价目页 |
| `book-mall/app/admin/finance/cloud-pricing/page.tsx` | 在库价目（导入版本管理） |
| `finance-web/app/admin/billing/users/[userId]/page.tsx` | 单用户明细 |
| `finance-web/app/admin/billing/all/page.tsx` | 全用户明细 |
| `finance-web/app/admin/pricing-disclosure/page.tsx` | 价格公示入口（链接卡片） |
| `finance-web/components/bill-details-client.tsx` | 明细表格组件（mode = single-user / all-users） |
| `finance-web/components/admin-sidebar.tsx` | 侧栏导航 |

### 17.2 npm 脚本（在 `book-mall/`）

```
db:deploy                          # prisma migrate deploy
db:apply-pending                   # 自定义 SQL 迁移补丁
pricing:realign-from-md            # dry-run
pricing:realign-from-md:apply      # 写库 D
pricing:inspect-billable-vs-md     # 审计 D vs B（CI 必跑）
pricing:audit-billable-vs-source   # 审计 D vs PricingSourceLine
pricing:verify-billable-formula    # 公式校验
pricing:verify-disclosure-rows     # 公示数据校验
pricing:emit-catalogs              # 由 D 反向生成 C
wallet-holds:expire                # 兜底脚本（非 Vercel 部署）
```

### 17.3 配套文档

| 文档 | 角色 |
| --- | --- |
| `book-mall/doc/finance/finance-rule-v1.0.md`（本文） | **唯一规则源** |
| `book-mall/doc/finance/00-pricing-source-of-truth.md` | 财务总宪（v0：价格基线/公式/偏差登记） |
| `book-mall/doc/product/02-users-billing-and-balance.md` | 用户层级 / 订阅 / 余额产品定义 |
| `book-mall/doc/product/points-wallet-topup-spec.md` | 充值入账 / 充送优惠券规范 |
| `book-mall/doc/product/03-metering-llm-and-tools.md` | 计量与扣点产品文档 |
| `book-mall/doc/database/schema-changelog.md` | DB 结构变更登记 |
| `book-mall/doc/releases/2026-05-16-per-second-billing-and-model-calibration.md` | 按秒计费 + WalletHold 引入 |
| `book-mall/doc/releases/2026-05-18-pricing-baseline-realign-and-disclosure.md` | 本次 D 重对齐 + 公示统一 + 全用户明细 + happyhorse 退款 |

---

## 18. 变更历史

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-05-18 | 首版整合：B/C/D/R 四层 + reserve/settle/release/expire 状态机 + cloudRow 修正凭证规范 + finance-web 全用户明细 + 价格公示统一组件。 |
| v1.0-phase-d | 2026-05-27 | **附录 A**：工具按月技术服务费；AI 类 toolKey 的 usage reserve/settle **不再扣钱包**；课程 `Subscription` 与工具准入解耦。详见 `doc/logic/tool-monthly-service-fee.md`。 |

---

## 附录 A — Phase D 工具技术服务费（2026-05-27）

自 Phase D 起，工具站 AI 生成路径（试衣、文生图、图生视频、视觉实验室、智能客服等）：

1. **准入**：用户须具备对应 `toolNavKey` 的 **有效 `UserToolServicePeriod`**（管理员直通）；不再要求「黄金会员 + 课程/单品工具订阅」。
2. **扣费**：开通/续订时从钱包 **一次性扣 `ToolServiceFeePlan.monthlyFeePoints`**，延长 30 天；**单次生成不扣点**（`isServiceFeeMeteredToolKey` 跳过 usage 钱包扣费）。
3. **云厂商**：用户 BYOK 经 Gateway；Book 不对每次生成记 `ToolUsageEvent` 扣点（可保留 audit-only，`costPoints=0`）。
4. **课程**：`Subscription` 会员计划 **仅课程**；`toolsNavAllowlist` 不再用于工具 navKey 解析。

WalletHold / Scheme A 按次扣点规则仍适用于 **非 AI 服务类** toolKey（若有）；AI 类前缀见 `book-mall/lib/tool-service-fee/config.ts`。

