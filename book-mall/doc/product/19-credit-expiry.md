# 19 · 积分清零与批次到期（积分清零 1.0）

> 权威规则正文见 `docs/积分清零.md`（对用户公示口径）；本篇为**产品 + 技术实现**说明。
> 关联：`14-tenant-team-design`（月度重置）、`17-referral-sharing`（注册赠送）、`18-vip-package`（VIP 永久）。

## 1. 目标

把原「积分长期不清零」改为**按来源分别到期**；会员**付费服务**与**积分刷新**两层周期解耦：

| 层级 | 口径 | 存储 |
|---|---|---|
| 会员付费服务（准入） | 月付 **+31 天**、年付 **+365 天**（支付成功时刻点到点） | 个人 `CreditAccount.membershipPaidUntil`；团队 `Tenant.currentPeriodEnd` |
| 订阅积分刷新 | 每 **31 天** 清零并重发（付费有效期内） | `CreditAccount.currentPeriodEnd` |

| 来源 `CreditSource` | 到期口径 | 说明 |
|---|---|---|
| `SUBSCRIPTION` 订阅赠送 | **31 天清零**（`expiresAt = currentPeriodEnd`，每 31 天按 `periodKey` 换发） | 年付会员在 365 天付费期内仍每 31 天刷新；期满停止 |
| `TOPUP` 单独充值 | **12 个月**（`now + 12M`） | 可叠加；会员到期不影响 |
| `FREE` 活动/注册赠送 | **30 天**（`now + 30D`） | 注册欢迎积分归此类 |
| `TOPUP`（VIP 大额预充） | **永久**（`expiresAt = null`） | 保大额客户权益 |
| 历史回填 | **永久**（`expiresAt = null`） | 上线不清零老用户 |

## 2. 架构：CreditLot 覆盖层

账户池余额 `CreditAccount.balanceCredits / videoBalanceCredits` 仍为**快路径真相**；
`CreditLot` 是「按来源分别到期」的覆盖层，用于**扣费优先级**与**到期清扫**。

**不变量**：`sum(未过期 lot.remaining, pool) == 账户该池已拥有额度 = balance + reserved`。

因此各流水对批次的影响由 **ownedDelta = credits + reservedDelta** 决定：

| 流水 | credits | reservedDelta | ownedDelta | 批次动作 |
|---|---|---|---|---|
| GRANT / TOPUP | +c | 0 | +c | 建批次（带 source+expiresAt） |
| CONSUME | −c | 0 | −c | FIFO 扣批次 |
| RESERVE | −c | +c | 0 | **不动**（冻结仍属已拥有） |
| SETTLE | 0 | −c | −c | FIFO 扣批次 |
| RELEASE | +c | −c | 0 | **不动** |
| REFUND | +c | 0 | +c | 回补批次 |
| EXPIRE（清扫/月重置写入） | −c | 0 | −c | `skipLotSync`，由清扫自身管理批次 |

## 3. 扣费顺序（FIFO）

`sortLotsForSpend`：`expiresAt` 升序（`null` 最后）→ 来源 rank（`SUBSCRIPTION < FREE < TOPUP`）→ `grantedAt` 升序。

即「**优先消耗最先到期**」，实际约等于「订阅(月) → 免费(30天) → 充值(12月) → 永久」，比文档字面「订阅→充值→免费」对用户更公平。

## 4. 代码位置

- 纯逻辑（可单测）：`lib/billing/credit-lot-logic.ts`
  - `sortLotsForSpend` / `planAllocation` / `planRestoreTargetId` / `planExpiry` / `computeOwnedDelta` / `resolveLotExpiry` / `addDays` / `addMonths` / `monthPeriodKeyOf`
- 会员付费周期：`lib/billing/membership-service-period.ts`
  - `MEMBERSHIP_SERVICE_DAYS` / `membershipPaidUntilFromPurchase` / `extendMembershipPaidUntil` / `isMembershipServiceActive`
- 事务与 DB：`lib/billing/credit-account-service.ts`
  - `writeLedger` 内 `syncLotsForLedger`（集中批次分配/回补）
  - `grantCredits`（`lotSource`/`lotExpiresAt`）、`topupCredits`（`source`/`expiresAt`）
  - `resetMonthlyCredits`（**仅**清零并重发订阅批次，保留充值/免费）
  - `expireDueLotsForAccount` / `sweepExpiredLots` / `runMonthlyResetSweep` / `getLotBreakdown`
- 各来源打标签：
  - 订阅：`fulfill-checkout.ts` / `apply-mock-membership-subscribe.ts`（默认 SUBSCRIPTION + `currentPeriodEnd`）
  - 充值：`wallet-topup-fulfill.ts` / `apply-mock-credit-topup.ts`（默认 TOPUP + 12M）
  - 免费：`welcome-gift.ts`（`source=FREE`，30D）
  - VIP：`vip-package-service.ts`（`lotSource=TOPUP`，`lotExpiresAt=null`）

## 5. 定时任务（`vercel.json` crons）

| 路径 | 频率 | 作用 |
|---|---|---|
| `POST /api/admin/credits/expire-sweep` | 每日 00:15 | `sweepExpiredLots`：过期批次写 EXPIRE、归零、扣余额 |
| `POST /api/admin/credits/monthly-reset` | 每日 00:30 | `runMonthlyResetSweep`：`currentPeriodEnd<=now` 且**会员服务仍有效**的订阅账户按 **31 天** 滚动刷新 |

鉴权（同 `wallet-holds/expire`）：`x-vercel-cron:1` / `Authorization: Bearer <CREDITS_CRON_SECRET|CRON_SECRET>` / `?secret=` / 管理员登录。
`scripts/grant-monthly-credits.ts` 保留为等价的**手动/排障**入口（不再禁 cron）。

## 6. 迁移与回填

- schema：`enum CreditSource` + `model CreditLot`（`prisma/migrations/20260720120000_credit_lot`）。
- 防火墙规避：`scripts/apply-credit-lot-migration.ts`（运行时连接幂等应用 DDL），已在 `_prisma_migrations` 记录。
- 历史回填：`scripts/backfill-credit-lots.ts`（对现有账户按池各建 1 个**永久** `TOPUP` 批次，`refType=legacy_backfill`，幂等）。

## 7. 退款规则（概要，公示见 `docs/积分清零.md` §4 / `/pricing-disclosure#credit-expiry`）

- 订阅会员：开通 7 日内且**未消耗任何订阅赠送积分**可全额退订阅费；产生消耗即视为已交付。
- 充值积分：无质量问题不无理由退款；重复扣款/未到账等异常 72h 内凭证核实原路退，已消耗不退。
- 免费/赠送积分不参与退款折现；过期清零、封禁、周期结束不退。

## 8. 测试

- 单测：`test/unit/credit-lot-logic.test.ts`（FIFO 排序、分配、回补目标、到期封顶、来源默认到期、ownedDelta）。
- 单测：`test/unit/membership-service-period.test.ts`（会员付费 31/365 天、续费顺延、准入判断）。
- 集成（DB）：`test/integration/credit-lot-expiry.integration.ts`（`pnpm test:credit-lot-integration`）——三类来源到期、FIFO 跨批次、reserve→settle、reserve→release、refund 回补、到期清扫 EXPIRE、月度重置保留充值、**每步对账不变量**。

## 9. 影响面

- **返佣**：计算基数用 `Order` 实付金额，与积分到期无关，不受影响。
- **团队共享池**：批次挂 `CreditAccount(ownerType=TENANT)`，逻辑一致；per-seat cap 不变。
- **BYOK / 资源计量**：不走积分池，不受影响。
- **对账 / 归档**：EXPIRE 沿用既有流水类型，`CreditLedgerArchive` 无需改。
