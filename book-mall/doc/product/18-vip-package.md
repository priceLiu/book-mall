# VIP 大额套餐（按充值金额定制）

> 面向大额预充客户（如 ¥20 万对等积分，**起订 ¥100,000**）的定制套餐：
> 财务后台按充值金额测算「通用多 / 视频多」两套积分方案供客户二选一，
> 一键开通 VIP 团队并一次性发放双池积分。VIP 积分**长期有效、不清零**。

## 1. 形态

- VIP 作为 **TEAM 租户的变体**按需创建（`Tenant.type=TEAM`、`packageLevel="VIP"`、`planId=null`）。
- **一次性预充**：`monthlyGrantCredits=0`、`videoMonthlyGrant=0`、`currentPeriodEnd=null`——
  月度重置脚本（若启用）据此跳过该账户，积分不清零（见需求 5）。
- 席位可自主分配：`seatLimit` 由财务设定；`perSeatCapCredits` 默认取「通用积分 ÷ 席位」平均值（治理用）。

## 2. 测算口径（保证毛利）

- 保守满额消耗：**通用 ¥0.016/积分**（锚定 ¥0.04 ÷ M 2.5）、**视频 ¥0.0267/积分**（锚定 ¥0.04 ÷ M 1.5，取保守低毛利）。
- 令充值金额 `A`、目标毛利 `m`、视频占比 `f`：
  - 混合单位成本 `c(f) = (1−f)·0.016 + f·0.0267`
  - 每积分售价 `p = c(f) ÷ (1−m)`
  - **总积分 `T = A ÷ p`**，通用 `= (1−f)·T`，视频 `= f·T`
- **毛利由「调总积分」恒定保证**：视频占比越高、同毛利下总积分越少。
- 两方案：**通用多**（默认 `f=15%`）/ **视频多**（默认 `f=40%`），`f` 与目标毛利均可在后台调整。

## 3. 实现

| 层 | 文件 |
|---|---|
| 纯函数测算 | `book-mall/lib/finance/vip-package-calculator.ts`（`computeVipPackageQuote` / `computeVipCreditScheme` / 席位分配与守恒校验） |
| 单元测试 | `book-mall/test/unit/vip-package-calculator.test.ts` |
| 开通服务 | `book-mall/lib/finance/vip-package-service.ts` · `provisionVipPackage`（建 VIP 团队 + `grantCredits` 双池发放，幂等键 `vip_grant:<tenantId>`） |
| 测算 API | `POST /api/finance/admin/vip-packages/quote`（`canViewFinanceCost`） |
| 开通 API | `POST /api/finance/admin/vip-packages/provision`（`canManagePricing`） |
| 后台页 | finance-web `/admin/vip-packages`（`FinanceAdminGate require="managePricing"`） |

## 4. 权限

- **测算器**：管理员 / 财务（`canViewFinanceCost`）可用。
- **开通**：仅财务管理员（`canManagePricing`）。
- 其他角色不可见 / 不可用（finance-web `FinanceAdminGate` + book-mall API 双重校验）。

## 5. 席位积分分配

- **自动**：`computeVipSeatAllocation` 平均分配，余数归首席，保证通用/视频各自合计守恒。
- **手动**：`validateVipManualAllocation` 校验逐席合计 == 池总数，否则拒绝（总数不变约束）。
- 当前实现按团队 **共享池** 发放（`CreditAccount ownerType=TENANT`）+ `perSeatCapCredits` 治理；
  逐席「独立钱包」如需硬隔离，后续可扩展 Seat 级子账户（非本期）。

## 6. 积分不清零（需求 5，已确认）

- 全站积分口径：**长期有效、不清零**。
- 核查结论：`resetMonthlyCredits` **仅**被手动脚本 `scripts/grant-monthly-credits.ts` 调用；
  `book-mall/vercel.json` 的唯一 cron 为 `wallet-holds/expire`（释放过期预占），**不触碰月度积分**。
  无任何定时任务/请求路径自动重置月度积分。
- VIP 一次性预充 `monthlyGrantCredits=0`、`currentPeriodEnd=null`，即便将来误跑重置脚本也会被跳过。
- **运维红线**：不得把 `pnpm credits:grant-monthly` 挂到 cron（脚本头部已加警示）。

## 7. 测试用例

| # | 场景 | 期望 |
|---|---|---|
| V1 | ¥200,000 @ 50%，通用多(f=15%)/视频多(f=40%) | 两方案实际毛利均 ≈ 50%；通用多方案总积分 > 视频多 |
| V2 | 视频占比↑，同毛利 | 总积分↓（视频单位成本更高） |
| V3 | 金额 < ¥100,000 | `meetsMinimum=false`；开通接口拒绝 |
| V4 | 席位自动分配（余数归首席） | 通用/视频各自合计守恒（`computeVipSeatAllocation` 单测） |
| V5 | 手动分配合计 ≠ 池总数 | `validateVipManualAllocation` 拒绝 |
| V6 | 开通 VIP（有效 ownerUserId） | 建 TEAM 租户 `packageLevel=VIP`，双池发放，`monthlyGrant=0` |
| V7 | 重复开通（同 tenant 幂等键） | `vip_grant:<tenantId>` 幂等，不重复发放 |
| V8 | 权限：测算 viewCost、开通 managePricing | 其他角色 403 |

单测：`book-mall/test/unit/vip-package-calculator.test.ts`（V1/V2/V3/V4/V5）。
