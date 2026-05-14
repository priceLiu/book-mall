# 点数制钱包、充值入账与「充送」（优惠券）— 需求与实现说明

> **状态**：入账统一走 `fulfillWalletTopupCredits`；**充送**以 **优惠模板 + 用户领取券 + 充值核销** 闭环实现，便于「发放入口 / 核销出口」对账。  
> **单位**：**100 点 = 1 元**（**1 点 = ¥0.01**），与历史「分」整数刻度一致，仅字段与文案统一为「点」。

---

## 1. 改了什么（摘要）

| 类别 | 内容 |
|------|------|
| **语义** | 全站整数余额/单价/订单金额字段统一为 **点**；与人民币的换算固定为 **÷100 得元（展示）**，**禁止**臆造其它比例（如 1 点 = 1 元）。 |
| **迁移** | 除历史 `*Minor`→`*Points` 改名迁移外，另有 **充值优惠** 表（见 `doc/database/schema-changelog.md`）；未执行迁移的环境会报表/列不存在，需 `pnpm run db:deploy`。 |
| **充值入账** | 统一入口 **`fulfillWalletTopupCredits`**（`lib/wallet-topup-fulfill.ts`）：一次事务内 **加余额 + `Order(WALLET_TOPUP)` + `WalletEntry(RECHARGE)`**。模拟充值 **`applyMockWalletTopup`** 仅调用该入口。 |
| **充 N 送 M（产品规则）** | **不对普通用户开放「任意 bonus 直塞」**。平台在后台配置 **`RechargePromoTemplate`**；用户在 **`/account/recharge-promos`** **领取优惠券** 生成 **`UserRechargeCoupon`**（含 `paidAmountPointsSnap` / `bonusPointsSnap` 等快照）；**充值时**传入 **`rechargeCouponId`** 核销，方记入赠送点。**未领取或未核销**则仅 **实付本金** 到账。 |
| **券时效** | 领取时根据模板 **`validDaysAfterClaim`** 计算 **`expiresAt`**；定时/入口侧将 **UNUSED 且已过期** 批为 **EXPIRED**（见 `lib/recharge-coupon.ts`）。 |
| **订单 meta** | `Order.meta.topup` 含 `paidAmountPoints`、`bonusPoints`、`creditedTotalPoints`；核销充送时另存 **`rechargeCouponId`**（`UserRechargeCoupon.id`），与 **`UserRechargeCoupon.orderId`** 互链，便于对账。 |
| **线下调 / 迁移** | `fulfillWalletTopupCredits` 仍支持可选 **`bonusPoints` + `promo`**，且 **禁止与 `rechargeCouponId` 同用**；模拟 API **不再接受** `bonusPoints` / `promo`。 |

---

## 2. 数据模型（对账视角）

| 实体 | 作用 |
|------|------|
| **`RechargePromoTemplate`** | 平台配置的优惠 **模板**：slug、标题、**实付档位** `paidAmountPoints`（须与核销时本金 **完全一致**）、`bonusPoints`、领取时间窗 `claimableFrom`/`claimableTo`、`validDaysAfterClaim`、`maxClaimsPerUser` 等。 |
| **`UserRechargeCoupon`** | 用户 **领取** 后的券：`UNUSED` \| `REDEEMED` \| `EXPIRED`；**快照字段**保证模板后续修改不影响已发券；核销后 **`orderId`** 指向 `Order`。 |
| **`Order`（WALLET_TOPUP）** | 到账合计 = 本金 + 赠送（若有）；`meta.topup.rechargeCouponId` 标识本次核销的券（若有）。 |

**管理后台**：`/admin/finance/promo-templates`（模板 CRUD，有领取记录则不可删模板，可下架 `active=false`）。

---

## 3. 会影响什么

- **用户侧**：余额与扣费逻辑不变；使用充送券时 **到账点数 = 实付本金 + 券快照赠送**；无券或未勾选核销则 **仅实付到账**。
- **「充值明细」管理页**（`WalletEntry` RECHARGE）：无赠送时一条 RECHARGE；有赠送时同一 `orderId` 下 **两条**（本金 + 赠送说明）。
- **订单列表**：`Order.amountPoints` 对 `WALLET_TOPUP` 为 **本次到账合计**。
- **财务 / GMV**：勿用 `SUM(Order.amountPoints)` 当实收；用 **`meta.topup.paidAmountPoints`** 汇总实收点；赠送为营销侧成本口径。可按 **`UserRechargeCoupon`**（领取）与带 **`rechargeCouponId`** 的订单（核销）做 **发放 vs 消耗** 核对。

---

## 4. 遗留与后续

| 项目 | 说明 |
|------|------|
| **老订单 meta** | 无 `meta.topup` 的老 `WALLET_TOPUP`：`parseOrderTopupBreakdown` 为 `null` 时按 **paid = amountPoints, bonus = 0**。 |
| **财务核对页** | **`/admin/finance/reconciliation`** 与 CSV 仍可按 `meta.topup` 拆实收/赠送；`rechargeCouponId` 可导出入库后做二次核对。 |
| **真实支付** | notify 验签成功后调用 **`fulfillWalletTopupCredits`**，须带上用户当笔支付意图中的 **`rechargeCouponId`**（若有）；见 `doc/process/real-payment-integration.md`。 |
| **风控** | `assertReasonableTopupBonus`（`lib/wallet-topup-fulfill-shared.ts`）约束单笔赠送上限；券路径使用快照中的 `bonusPointsSnap`。 |
| **提现** | 赠送与本金合并为同一余额；法规若要求区分可退范围，需另议（当前未实现）。 |

---

## 5. 开发约定（避免系数错误）

1. **唯一整数源**：持久化只用 **点（整数）**；元仅展示或渠道中间量，入账前转整数点。  
2. **统一工具**：复用 `formatPointsAsYuan` 等。  
3. **核销档位**：券的 **`paidAmountPointsSnap`** 必须与 **`fulfillWalletTopupCredits.paidAmountPoints`** **完全一致**，否则拒绝核销。

---

## 6. 接口与示例

### `fulfillWalletTopupCredits`（推荐：优惠券核销）

```ts
await fulfillWalletTopupCredits({
  userId,
  paidAmountPoints: 100_00,
  rechargeCouponId: "clxxxxxxxx...", // 用户已领取、UNUSED、未过期、快照档位一致
  meta: { channel: "alipay", tradeNo: "..." },
});
// 到账 10000 + bonusPointsSnap；Order.meta.topup 含 rechargeCouponId；券置 REDEEMED 并写 orderId
```

### 无赠送（仅本金）

```ts
await fulfillWalletTopupCredits({
  userId,
  paidAmountPoints: 100_00,
  meta: { channel: "alipay", tradeNo: "..." },
});
```

### 内部兼容（勿与 rechargeCouponId 同用）

```ts
await fulfillWalletTopupCredits({
  userId,
  paidAmountPoints: 100_00,
  bonusPoints: 120,
  promo: { slug: "manual_adjust", label: "人工/脚本" },
});
```

### 模拟充值 Body（开发 / `ALLOW_MOCK_PAYMENT`）

```json
{
  "amountPoints": 10000,
  "rechargeCouponId": "可选；与 amountPoints 档位一致的 UNUSED 券 ID"
}
```

用户侧流程：先打开 **`/account/recharge-promos`** 领取；再在 **`/pay/mock-topup`** 选择是否核销（同档多张券时单选一张）。

---

## 7. 相关文件

- `lib/wallet-topup-fulfill.ts` — 入账核心、`parseOrderTopupBreakdown`、`aggregateWalletTopupOrdersBreakdown`  
- `lib/wallet-topup-fulfill-shared.ts` — `assertReasonableTopupBonus`  
- `lib/recharge-coupon.ts` — 过期、领取、列表  
- `lib/apply-mock-topup.ts` — 模拟充值白名单 + 调用 fulfill  
- `app/api/dev/mock-topup/route.ts`  
- `app/actions/recharge-promo.ts` — 用户领取  
- `app/actions/recharge-promo-admin.ts` — 模板管理  
- `app/(account)/account/recharge-promos/page.tsx`  
- `app/admin/finance/promo-templates/page.tsx`  
- `doc/process/real-payment-integration.md`、`doc/process/mock-payment-checkout.md`  

---

## 8. 版本记录

- **2026-05-13**：初版 — 点数口径 + 充值 fulfill 与 `meta.topup` 拆分。  
- **2026-05-14**：充送改为 **模板 + 领取券 + rechargeCouponId 核销**；新增 `RechargePromoTemplate` / `UserRechargeCoupon`；模拟 API 改为 `rechargeCouponId`；`meta.topup` 增加 `rechargeCouponId`。
