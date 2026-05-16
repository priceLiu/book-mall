# 后台：订阅/充值配置与提现审核

> 产品：`doc/product/05-admin.md` §5.3、`06-flows.md` §6.3、`07-operations.md`  
> 路由：`/admin/billing`、`/admin/refunds`、`/admin/finance/promo-templates`  
> 动作：`app/actions/billing.ts`、`app/actions/refunds.ts`、`app/actions/recharge-promo-admin.ts`

## 5.3 已实现能力（首期）

- **计费配置**：写入 `PlatformConfig` 单行（含 LLM/工具参考单价、异常倍数）。
- **订阅价（停旧发新 · 不可原地改）**：通过 `publishNewSubscriptionPlanVersion` 在事务里把旧 plan 改名为 `${slug}__v${ts}` + `active=false` + `archivedAt=now`，并复制创建持有主 slug 的新 plan，`parentPlanId` 串接历史链。老用户 `Subscription.planId` 仍指向归档 plan，可完整溯源当时价 / 名称 / 工具范围。前端有二次确认复选框 + 保存 banner；详见 `doc/releases/2026-05-16-subscription-plan-lineage.md`。
- **订阅工具白名单**：`updateSubscriptionPlanToolsAllowlist` 仅允许在 active 且未归档的 plan 上修改；已归档 plan 锁死，保证"当时权益快照"不被改写。
- **手动续期**：按邮箱找到当前有效 `Subscription`，延长 `currentPeriodEnd`。
- **订单列表**：`Order` + 对订阅已支付未 `refundedAt` 的订单 **发起订阅提现审核**。
- **充值统计**：`WalletEntry` 类型 `RECHARGE` 的 `amountPoints` 汇总（到账口径，非支付渠道流水）。
- **充值优惠模板**：`/admin/finance/promo-templates` 维护 `RechargePromoTemplate`；用户侧领取与核销约定见 `doc/product/points-wallet-topup-spec.md`。
- **保存反馈**：上述所有 form action 统一返回 `BillingActionState = { kind: "ok" | "error", message }`，前端 `useActionState` 显式 banner 回显，不再"无声成功 / 无声失败"。

## 6.3 余额提现

1. 用户：`POST /api/account/wallet-refund`，写 `WalletRefundRequest`（`PENDING`），同一用户仅允许一条 `PENDING`。  
2. 管理员：`completeWalletRefund`：填 **应扣未扣**（点），可选 **提现额覆盖**；默认实提 = `min(申请额或余额, 余额) - 应扣未扣`，并从钱包扣减、记 `WalletEntry` 类型 `REFUND`。
3. `rejectWalletRefund`：`REJECTED`。

## 订阅提现审核

1. 管理员在 `/admin/billing` 订单表对订阅订单 **发起提现审核** → `SubscriptionRefundRequest`。  
2. `completeSubscriptionRefund`：`Order.refundedAt`、订阅 `EXPIRED`（优先 `subscriptionId`，否则该用户所有 `ACTIVE`）。  
3. `rejectSubscriptionRefund`：`REJECTED`。

## 与真实支付的差距

- 未接支付渠道 webhook；模拟接口会写 `Order` + 流水。生产需把 **实付确认** 与 `Order.status`、钱包入账联动。
