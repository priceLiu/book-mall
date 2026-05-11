# 会员状态计算（`getMembershipFlags`）

> 产品：`doc/product/02-users-billing-and-balance.md`  
> 代码：`lib/membership.ts`

## 规则

1. **`hasActiveSubscription`**：`Subscription.status === ACTIVE` 且 `currentPeriodEnd > now()`。取结束日期 **最新** 的一条。  
2. **`balanceMinor`**：`Wallet.balanceMinor`，无钱包视为 0。  
3. **`minBalanceLineMinor`**：`PlatformConfig` 单行 `default`，缺省 2000（= ¥20）。  
4. **`canUsePremiumMetered`**：`hasActiveSubscription && balanceMinor >= minBalanceLineMinor`。

## 非职责

- 不判断是否「应扣未扣」；扣费幂等与结算见后续计量模块与 `wallet-balance-and-refund.md`。  
- 不在此处拦截 HTTP 请求；API/页面守卫另行实现。
