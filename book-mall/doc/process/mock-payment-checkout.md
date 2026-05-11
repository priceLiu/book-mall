# 模拟收银（订阅与钱包充值 · 过渡方案）

> **定位**：在接入支付宝等真实渠道之前，用「占位收银页 + 单次确认」跑通 **订阅开通**、**钱包充值**、订单写入、个人中心与后台展示。**不作为真实收款能力。**

## 交互约定（订阅）

1. **假二维码**：仅占位视觉效果，**不扫、不调任何二维码 SDK**，不代表真实支付通道。
2. **唯一业务触发**：用户点击 **「支付成功」** 后调用接口，写入：
   - `Subscription`（ACTIVE，周期按套餐）
   - `Order`（`type: SUBSCRIPTION`，`status: PAID`，`meta.mock: true` 等）
3. **路由**：订阅页选择套餐并已登录 → **`/pay/mock-subscribe?plan=monthly|yearly`** → 跳转 **`/account`**。

## 交互约定（钱包充值）

1. **同样**：占位二维码 + **「支付成功」** 后入账。
2. **档位**：页面上可选 **¥50 / ¥100 / ¥200**（服务端白名单，见 `lib/apply-mock-topup.ts`），写入：
   - `Order`（`type: WALLET_TOPUP`，`PAID`）
   - `Wallet.balanceMinor` 增加、`WalletEntry`（`RECHARGE`）
3. **路由**：已登录 → **`/pay/mock-topup`**（可选 query **`amount`** = 分，如 `10000`；非法或未传则默认 ¥100）。

高级能力（高阶/按量工具）产品规则侧重：**订阅有效** 且 **余额不低于最低线**；演示路径建议先走订阅收银再走充值收银。

## 环境与安全（必读）

| 条件 | 行为 |
|------|------|
| `NODE_ENV === "development"` | 默认允许 `/api/dev/mock-subscribe`、`/api/dev/mock-topup` |
| 非 development | **默认禁止** 上述接口（返回 403） |
| `ALLOW_MOCK_PAYMENT=true` | **显式允许** 在非 development 环境调用上述模拟接口（预演 / Staging） |

**切勿在面向用户的真实生产环境将 `ALLOW_MOCK_PAYMENT` 设为 `true`**，否则任何人可伪造订阅与充值到账。上线真实支付后应移除或强制关闭该开关。

## 与其它故障的关系

个人中心、收银接口依赖数据库连接。**连接池超时、`Can't reach database server`（Neon 休眠、连接串未池化、超时过短等）** 与收银页复杂度无关，须按 [`doc/tech/stack-and-environment.md`](../tech/stack-and-environment.md) 核对 `DATABASE_URL` 与 Neon 状态。

## 相关代码入口

- 订阅：`components/subscribe/subscribe-client.tsx` → `/pay/mock-subscribe`
- 充值：`app/(account)/account/page.tsx`、`app/(site)/subscribe/page.tsx` → `/pay/mock-topup`
- 订阅收银 UI：`app/(site)/pay/mock-subscribe/page.tsx`、`components/pay/mock-subscribe-checkout.tsx`
- 充值收银 UI：`app/(site)/pay/mock-topup/page.tsx`、`components/pay/mock-topup-checkout.tsx`
- 占位二维码：`components/pay/fake-qr-placeholder.tsx`
- 落库：`lib/apply-mock-subscription.ts`、`lib/apply-mock-topup.ts`
- API：`app/api/dev/mock-subscribe/route.ts`、`app/api/dev/mock-topup/route.ts`

---

## 下一阶段：正式接入支付宝等渠道

模拟路径用于打通前端与账本字段；**真实收款**须改用渠道 **异步通知验签**、**幂等**、**金额与用户绑定校验** 等，不得以页面按钮代替支付结果。

完整清单见 **[real-payment-integration.md](./real-payment-integration.md)**（以支付宝扫码为主线，其它条码 / APP 支付可类比）。
