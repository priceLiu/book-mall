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
- **按秒计费 + WalletHold（2026-05-16）**：视频工具改为 **reserve→settle / release** 模式。`/api/sso/tools/usage` 加 `phase=reserve|settle|release|auto`；`PlatformConfig` 新增 `minBilledVideoSec=5 / minBilledImageCount=1 / minChargePointsPerInvoke=1 / walletHoldDefaultTtlMin=30`。**价格只按挂牌价**——云侧促销 / 免费额度不算成本，沉淀为平台利润。详见 `doc/releases/2026-05-16-per-second-billing-and-model-calibration.md` §按秒计费、§WalletHold。
- **reserve 覆盖范围**：image-to-video / 文生视频 / 参考生视频 / 文生图 / AI 试衣 在 start 阶段均会 reserve；调云失败必 release；settle 在事务内把 hold 转 SETTLED 并按"扣后水位线 = 余额 − frozen − Σ(其它 HELD)"硬门禁。**visual-lab/analysis 例外**：它在调云前已经同步 settle 完成扣费（强一致模式），不需要再加 reserve。
- **自动校准（2026-05-16）**：`/admin/finance/model-calibration` 顶栏「一键自动校准」按钮，调 `runFullAutoCalibration`：从 `ToolBillablePrice` 派生 catalog → 从 `PricingSourceLine` 派生 → 重扫 pending alias 把 HIGH/MEDIUM 自动绑定（LOW 留待审）。**每次 CSV 对账后**也会自动跑一遍。`recordToolUsageAndConsumeWallet` 同步在写 ToolBillingDetailLine 前反查 `INTERNAL_SCHEME_A_MODEL` 别名 → catalog，把 canonical 直接写进 cloudRow，让"同模型多名字"差额在**写入时**就归并；读侧 `applyCanonicalOverlayBatch` 仍兜底覆盖历史行。
- **模型校准（2026-05-16）**：`/admin/finance/model-calibration` 把"云·商品 Code/计费项 Code/规格/产品名称"、"我们·toolKey/scheme A 模型"、"price.md 标签"统一映射到 `canonicalKey`；提供 **单个录入** + **批量导入候选 JSON** + 自动建议（exact / prefix / fuzzy），HIGH 可一键批准。导入云 CSV 时自动 ingest 候选别名。

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
