# 分享返佣（邀请注册）

> 面向「个人套餐 月付 ¥599 / 年付 ¥1490 及以上」会员的分享拉新能力：
> 生成专属分享链接 → 好友免密注册并与分享人关联 → 分享人/财务查看业绩 →
> 财务后台逐人录入返佣比例。

## 1. 门禁（谁能分享）

- **资格**：个人套餐（`MembershipFamily.PERSONAL`）且
  - 月付 `priceYuan ≥ 599`，或
  - 年付 `priceYuan ≥ 1490`，
  - 「及以上」档位同样满足（按金额阈值判定，对套餐改名稳健）。
- **判定**：`lib/referral/referral-service.ts` · `getReferralEligibility(userId)`
  读取 `CreditAccount(ownerType=USER).planId → MembershipPlan`，校验
  `family / interval / priceYuan` 与有效期 `currentPeriodEnd`。
- **阈值常量**：`REFERRAL_MIN_MONTH_PRICE_YUAN = 599`、`REFERRAL_MIN_YEAR_PRICE_YUAN = 1490`。
- 个人中心仅在满足门禁时展示「分享返佣」菜单（`account-nav-menu-config.ts` · `showReferral`）。

## 2. 数据模型

迁移：`prisma/migrations/20260716160000_add_referral_profile`

- `User.referredByUserId`（自关联 `UserReferrals`）：通过分享链接注册时记录上线用户；
  仅在新建用户、或既有未归因用户首次注册时写入，**不覆盖**已有归因。
- `ReferralProfile`（分享人档案，1 用户 1 条）：
  - `code`（分享码，全站唯一，出现在 `/r/{code}`）
  - `commissionRate Decimal(5,4)`（0~1，默认 0 = 未设置；由财务后台录入）
  - `enabled`（财务可停用分享码）
  - `note` / `rateUpdatedAt` / `rateUpdatedBy`（财务备注与留痕）

> 比例**不在代码写死**，统一由财务管理员后台逐个分享人录入。

## 3. 分享链接与注册

- **入口**：个人中心 `/account/referral`
  - 满足门禁则自动 `ensureReferralProfile` 生成分享码并展示链接 `{origin}/r/{code}`；
  - 展示邀请人数、套餐消费、充值消费、返佣比例与预估返佣、邀请明细表。
- **落地页**：`/r/[code]`（`app/(site)/r/[code]/page.tsx`）
  - 服务端用 `resolveReferrerByCode` 解析（仅启用中的码），展示邀请人昵称；
  - 表单 `ReferralRegisterForm`：**昵称 + 手机号 + 短信验证码**，**免密码**。
- **注册 API**：`POST /api/auth/register`
  - 新增可选 `referralCode`；当带 `referralCode` 时允许省略 `password`（免密注册）。
  - 免密用户 `passwordHash = null`，后续可用**短信 OTP 登录**或在设置中补设密码。
  - 归因：`resolveReferrerByCode` 命中且非自荐 → 写 `referredByUserId`。
  - 计费身份默认 `PLATFORM_CREDIT`。
- **免密自动登录**：注册成功返回一次性 `autoLoginToken`
  （`lib/auth/auto-login-token.ts`，HMAC + NEXTAUTH_SECRET，TTL 2 分钟），
  前端 `signIn("credentials", { loginMode: "autologin", autoLoginToken })` 建会话；
  见 `lib/auth.ts` 凭据 provider 的 `autologin` 分支。

## 4. 业绩口径

`lib/referral/referral-service.ts`：

- **套餐消费** = `Order.status=PAID` 且 `type ∈ {SUBSCRIPTION, MEMBERSHIP, PRODUCT_SUBSCRIPTION, BYOK_SERVICE_FEE}` 的 `amountYuan` 之和。
- **充值消费** = `type ∈ {WALLET_TOPUP, CREDIT_TOPUP}` 的 `amountYuan` 之和。
- **总消费** = 套餐 + 充值；**预估返佣** = 总消费 × `commissionRate`。
- 数据实时统计，最终结算以平台为准（提现/打款暂未实现）。

## 5. 个人中心（分享人视角）

- 页面：`/account/referral`（`ReferralPanel`）。
- 展示：专属链接（复制）、邀请人数、套餐/充值消费、返佣比例与预估返佣、邀请明细（手机号脱敏）。
- 未达门禁：展示升级引导（跳转 `/pricing`）。

## 6. 财务后台（管理员视角）

- 页面：finance-web `/admin/referrals`（`ReferralsClient`，门禁 `viewCost`）。
- book-mall API（经 finance-web BFF 代理，复用 `lib/finance/finance-api`）：
  - `GET /api/finance/admin/referrals` → 全部分享人概览（`listReferralAdminOverview`，`canViewFinanceCost`）。
  - `POST /api/finance/admin/referrals/rate` → 录入比例/启停/备注（`setReferralCommissionRate`，`canManagePricing`）。
- 管理员可对**某个分享人**逐条录入返佣比例（0~100%）、停用分享码、加结算备注；
  比例修改留痕（`rateUpdatedAt` / `rateUpdatedBy`）。

## 7. 关键文件

| 层 | 文件 |
|---|---|
| 领域服务 | `book-mall/lib/referral/referral-service.ts` |
| 自动登录票据 | `book-mall/lib/auth/auto-login-token.ts`；`lib/auth.ts`（autologin 分支） |
| 注册 | `app/api/auth/register/route.ts`；`components/auth/referral-register-form.tsx`；`app/(site)/r/[code]/page.tsx` |
| 个人中心 | `app/(account)/account/referral/page.tsx`；`components/account/referral-panel.tsx`；`lib/account-nav-menu-config.ts` |
| 财务 API | `app/api/finance/admin/referrals/route.ts`；`app/api/finance/admin/referrals/rate/route.ts` |
| 财务前端 | `finance-web/app/admin/referrals/page.tsx`；`finance-web/components/admin/referrals-client.tsx` |
| Schema | `prisma/schema.prisma`（`ReferralProfile`、`User.referredByUserId`） |

## 8. 待办 / 后续

- 返佣**结算与打款**（提现流程、账期、对账）尚未实现，当前仅展示预估。
- 如需多级分销 / 防刷（同设备、风控）后续扩展。
