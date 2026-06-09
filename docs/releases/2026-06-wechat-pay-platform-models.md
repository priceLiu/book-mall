# 发布说明：微信个人收款 + 平台模型自动上架

## 面向用户

- 会员 / BYOK / 轻量包统一走 **`/checkout/*`** 收银页
- 普通用户：展示**真实微信个人收款码** + **6 位转账备注码**；点「我已完成支付」后进入待核对，**不会自动到账**
- 平台员工（ADMIN/FINANCE）自购：假码 + **管理员确认到账**，但 DB 链路与普通用户一致

## 面向管理员 / 财务

- Book **`/admin/payments`**：6 位备注码检索、待核对列表、确认到账 / 拒绝取消、代客开通
- finance-web **`/admin/reconciliation`** 顶部：**支付明细**（PaymentCheckout + Order + CreditLedger）
- finance-web **`/admin/platform-models`**：按 app × scenario 查看当前上架 vendor、毛利、候选列表；**同步自动上架**；**锁定路由**后自动引擎不再切换
- 保存模型成本（model-cost）后会**异步触发**自动上架重算

## 多厂商（PLATFORM_CREDIT）

- 同场景多 vendor 成本入库后，自动选**最低净成本且过毛利护栏**的模型 → `ACTIVE`
- 前台 picker（电商分镜 / Canvas / 工具站 lab / Prompt Optimizer / Story 配置）**隐藏厂商分组**；BYOK 用户行为不变

## 环境变量（book-mall）

| 变量 | 说明 |
|------|------|
| `WECHAT_PAYEE_NAME` | 收款人姓名（收银页展示） |
| `WECHAT_PERSONAL_QR_URL` | 默认 `/payments/wechat-personal-qr.png` |
| `PAYMENT_CHECKOUT_EXPIRE_HOURS` | 默认 24 |

静态收款码：`book-mall/public/payments/wechat-personal-qr.png`

## 升级步骤

1. `cd book-mall && pnpm db:deploy`
2. 配置上述 env，部署收款码图片
3. （可选）`pnpm exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts`
4. finance-web → **平台模型** → **同步自动上架**
5. 重启 book-mall / finance-web

## 废弃入口

- 前台不再使用 `/api/dev/mock-*` 作为主路径；`/pay/mock-subscribe` 重定向至 `/pricing`
- dev 脚本与 `/api/dev/mock-*` 仍保留供本地脚本参考
