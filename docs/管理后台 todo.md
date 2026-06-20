# 管理后台 · 待修复（TODO）

> 记录时间：2026-06-20  
> 页面：`book-mall/app/admin/page.tsx`（概览）  
> 关联：支付核对 `/admin/payments`、`fulfillPaymentCheckout`、财务 2.0 `CreditAccount` / `CreditLedger`

---

## 1. 概览数字与后台确认充值不一致（P0）

### 现象

- 概览「累计充值入账」320,000 点、「充值笔数」3、「全站可用余额」285,885 点
- 与「支付核对」里已确认到账的笔数/金额对不上

### 根因

概览仍统计 **旧钱包** `Wallet` / `WalletEntry(RECHARGE)`；  
后台支付确认走 **财务 2.0**，写入 `CreditLedger(TOPUP/GRANT)` + `CreditAccount`，**不写** `WalletEntry`。

依据：

- `book-mall/lib/wallet-topup-fulfill.ts`：充值入账（财务 2.0）写入 CreditAccount，**不再写 WalletEntry**
- `book-mall/lib/payments/fulfill-checkout.ts`：`fulfillPaymentCheckout` → `topupCredits` / `grantCredits`

320,000 / 3 笔很可能来自开发脚本（如 `dev-reset-user-billing.ts` 300,000 点、`calibrate-pilot-tool-billing.ts` 100,000 点），非运营充值。

### 待办

- [ ] 概览「累计充值 / 充值笔数」改读 `PaymentCheckout(PAID)` 和/或 `CreditLedger(TOPUP)`（会员 GRANT 单独展示）
- [ ] 「全站可用余额」改读 `CreditAccount.balanceCredits` + `videoBalanceCredits`（或统一 reconciliation 口径）
- [ ] 卡片文案区分「旧钱包（Wallet）」与「积分账（Credit）」，避免混读
- [ ] 提供 SQL / 管理页核对：`WalletEntry RECHARGE` vs `CreditLedger TOPUP/GRANT` vs `PaymentCheckout PAID`

---

## 2. 「有效订阅」口径过期（P1）

### 现象

概览 `Subscription` 表 ACTIVE 计数，与真实可工具准入会员可能不一致。

### 根因

- 概览：`prisma.subscription.count({ status: ACTIVE, currentPeriodEnd > now })`
- 实际准入：`CreditAccount.planId` + `currentPeriodEnd`，或团队 `Tenant.planId`（见 `membership-tool-access.ts`）
- `fulfillPaymentCheckout` 开通会员 **不写** 旧 `Subscription` 表

### 待办

- [ ] 有效会员改数 `CreditAccount` / `Tenant` + `MembershipPlan`
- [ ] 或概览同时展示「旧 Subscription（遗留）」与「积分会员（当前）」两列

---

## 3. 「充值明细」链接错误（P1）

### 现象

概览「查看充值明细 →」指向 `/admin/finance/recharges`，实际跳转到 finance-web **会员套餐**，不是充值流水。

### 根因

`book-mall/app/admin/finance/recharges/page.tsx` → `redirectToFinanceWeb("/admin/membership-plans")`

### 待办

- [ ] 链接改为 finance-web 支付/积分流水页，或 book-mall 支付核对列表
- [ ] 导航「充值明细」与概览卡片统一入口

---

## 4. 「各工具使用次数」与充值/积分无关（P2）

### 现象

底部柱状图按 `ToolUsageEvent.toolKey` 汇总，无法反映 Gateway / 积分消耗。

### 待办

- [ ] 概览改为 `CreditLedger CONSUME` 或 Gateway 用量摘要，或明确标注「旧工具站流水，非积分账」

---

## 5. 文档与规则不同步（P2）

### 待办

- [ ] 更新 `book-mall/doc/finance/finance-rule-v1.0.md` §7：标明 Wallet 为遗留，CreditAccount 为当前真源
- [ ] 概览页 footnote 指向 `.cursor/rules/gateway-billing-units.mdc` 与财务 2.0 说明

---

## 6. 人像入库 CreateAsset · Name 超长失败（P1）

### 现象

Gateway 日志 `model=portrait:virtual`、失败原因：

`CreateAsset 失败: InvalidParameter.Name: Name must be no more than 64 characters`

### 说明

- 非文生图模型；为火山私域虚拟人像库入库（`portrait:virtual`）
- 代码已有 `sanitizeVolcenginePortraitName`（`volcengine-portrait-actions.ts`，64 字符上限）

### 待办

- [ ] 排查 `canvas-portrait-import-service` 全路径是否均走 `sanitizeVolcenginePortraitName`
- [ ] 确认是否另有 `ProjectName` 等字段未截断
- [ ] 失败时在 UI 提示「名称过长已自动截断」或让用户可编辑入库名称

---

## 7. 复核 SQL（运维）

```sql
-- 旧钱包（概览当前口径）
SELECT COUNT(*), SUM("amountPoints") FROM "WalletEntry" WHERE type = 'RECHARGE';
SELECT SUM("balancePoints") FROM "Wallet";

-- 财务 2.0（应对齐后台确认）
SELECT status, "productKind", COUNT(*) FROM "PaymentCheckout" GROUP BY 1, 2;
SELECT type, COUNT(*), SUM(credits) FROM "CreditLedger"
  WHERE type IN ('TOPUP','GRANT') GROUP BY type;
SELECT SUM("balanceCredits"), SUM("videoBalanceCredits") FROM "CreditAccount";

-- 会员
SELECT COUNT(*) FROM "Subscription"
  WHERE status = 'ACTIVE' AND "currentPeriodEnd" > NOW();
SELECT COUNT(*) FROM "CreditAccount"
  WHERE "planId" IS NOT NULL
    AND ("currentPeriodEnd" IS NULL OR "currentPeriodEnd" > NOW());
```
