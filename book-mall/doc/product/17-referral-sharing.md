# 分享链接 1.0（邀请注册 / 分享返佣）

> 面向**任意有效订阅**（个人套餐或团队主账号）会员的分享拉新能力：
> 生成专属分享链接 → 好友免密注册并与分享人关联 → 新用户获赠积分 →
> 分享人/财务查看业绩 → 财务后台按统一默认比例（可逐人调整）返佣。

## 1. 门禁（谁能分享）— 分享链接 1.0

- **资格（放开档位门槛）**：任意有效订阅均可生成分享链接：
  - **个人套餐**（`MembershipFamily.PERSONAL`，**任意档**，已取消 ¥599/¥1490 门槛），或
  - **团队 OWNER**（`TenantRole.OWNER`，团队 ACTIVE 且 `Tenant.planId` 有效、`currentPeriodEnd` 未过期）。
- **严格排除**：**团队非 OWNER 成员**（ACTIVE 的 `ADMIN` / `MEMBER`，团队 ACTIVE）**一律不可**分享——
  即便其另有个人订阅，也以此排除为最高优先级。
- **判定**：`lib/referral/referral-service.ts` · `getReferralEligibility(userId)`：
  1. 命中 `TenantMember(role∈{ADMIN,MEMBER}, status=ACTIVE, tenant.type=TEAM, tenant.status=ACTIVE)` → 不合格（`团队成员不可分享`）；
  2. `CreditAccount(ownerType=USER).planId` 有效且 `MembershipPlan.family=PERSONAL`、有效期内 → 合格；
  3. 团队 OWNER 且团队套餐有效 → 合格。
- 个人中心仅在满足门禁时展示「分享返佣」菜单（`account-nav-menu-config.ts` · `showReferral`；由 `(account)/layout.tsx` 传 `getReferralEligibility().eligible`）。

## 2. 数据模型

迁移：`prisma/migrations/20260716160000_add_referral_profile`

- `User.referredByUserId`（自关联 `UserReferrals`）：通过分享链接注册时记录上线用户；
  仅在新建用户、或既有未归因用户首次注册时写入，**不覆盖**已有归因。
- `ReferralProfile`（分享人档案，1 用户 1 条）：
  - `code`（分享码，全站唯一，出现在 `/r/{code}`）
  - `commissionRate Decimal(5,4)`（0~1，**新建档案时取默认比例** `PlatformPricingConfig.referralDefaultRate`，缺省 0.05；财务可逐人调整）
  - `enabled`（财务可停用分享码）
  - `note` / `rateUpdatedAt` / `rateUpdatedBy`（财务备注与留痕）

> 比例**不在业务代码写死**：默认值由 `PlatformPricingConfig.referralDefaultRate` 提供（财务可调），
> 逐人可在财务后台微调。

## 2.1 返佣测算（保证毛利）

- 公式：`最大返佣% = 产品毛利% − 目标毛利下限%`（返佣按订单实付 `amountYuan` 计）。
- 口径：保守满额消耗（不吃积分沉淀），通用 ¥0.016/积分、视频 ¥0.0267/积分（锚定 ¥0.04 ÷ M）。
- 全局最低毛利产品 ≈ **视频加量包 25.9%**，作为单一统一返佣的兜底约束：
  - 保 **20% 毛利** → 统一返佣 ≤ 5.9% → **默认 5%**；
  - 保 **15% 毛利** → 统一返佣 ≤ 10.9% → 可选 10%。
- 设计支持**逐套餐等级**不同返佣（各档毛利见 finance-web `/admin/referrals` 反算工具），当前统一取一个默认值。

## 2.2 新用户注册赠送（分享链接 1.0）

- 所有新注册用户（含分享落地注册）赠送积分：默认 **500 通用 + 100 视频**，归**免费积分（`source=FREE`）·30 天有效**（积分清零 1.0，见 `19-credit-expiry`）。
- 额度落 `PlatformPricingConfig.welcomeGiftGeneralCredits / welcomeGiftVideoCredits`（财务可调）。
- 发放：`lib/billing/welcome-gift.ts` · `grantWelcomeGift(userId)`（幂等，失败不阻断注册；`topupCredits({ source: "FREE" })` → 30 天到期批次）。
- 前端文案：价格页 hero、注册页 / 分享注册页均显示「30 天内有效」。
- 展示：价格页横幅 + 注册页 / 分享落地注册页（读同一配置，不硬编码）。

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

## 6.1 返佣结算 · 返佣单（怎么返 / 何时返）

- **计算基数**：下线用户在「结算周期」内 **实付**（`Order.status=PAID`，按 `paidAt` 落账；`paidAt` 为空回退 `createdAt`）的「套餐订阅 + 轻量包充值」金额合计。
- **应返佣金** = 计算基数 × 分享人当前返佣比例（**出单时定格快照**，之后改比例不影响历史返佣单）。
- **结算节奏**：按自然月出单（次月结算上月）；财务也可选任意月份手动计算。
- **流程**：财务选周期 → **计算**（预览，不落库）→ **生成返佣单**（`PENDING`）→ 线下打款后 **标记已支付**（`PAID`）；可 **作废**（`VOID`）；可 **导出 CSV** 作为打款依据。
- **幂等**：同一 `(分享人, periodKey)` 仅一张返佣单；重复「生成」为覆盖式 upsert，但 **已支付 / 已作废不被覆盖**。
- 页面：finance-web `/admin/referral-payouts`（门禁 `viewCost`，生成/打款需 `managePricing`）。
- API：`.../referral-payouts/preview`（计算）· `/generate`（生成）· `/list`（列出）· `/status`（打款/作废）。
- 服务：`lib/referral/referral-payout-service.ts`；模型：`ReferralPayout`（唯一 `referrerUserId+periodKey`）。

## 7. 关键文件

| 层 | 文件 |
|---|---|
| 领域服务 | `book-mall/lib/referral/referral-service.ts`；`lib/referral/referral-payout-service.ts` |
| 自动登录票据 | `book-mall/lib/auth/auto-login-token.ts`；`lib/auth.ts`（autologin 分支） |
| 注册 | `app/api/auth/register/route.ts`；`components/auth/referral-register-form.tsx`；`app/(site)/r/[code]/page.tsx` |
| 个人中心 | `app/(account)/account/referral/page.tsx`；`components/account/referral-panel.tsx`；`lib/account-nav-menu-config.ts` |
| 财务 API | `app/api/finance/admin/referrals/*`；`app/api/finance/admin/referral-payouts/*` |
| 财务前端 | `finance-web/app/admin/referrals/*`；`finance-web/app/admin/referral-payouts/*`（+ `components/admin/referral-payouts-client.tsx`） |
| Schema | `prisma/schema.prisma`（`ReferralProfile`、`ReferralPayout`、`User.referredByUserId`） |

## 8. 测试用例

### 8.1 门禁（`getReferralEligibility`）
| # | 场景 | 期望 |
|---|---|---|
| G1 | 个人套餐（任意档，有效期内） | 合格，菜单显示 |
| G2 | 无任何订阅 | 不合格（无有效订阅） |
| G3 | 团队 OWNER，团队套餐有效 | 合格 |
| G4 | 团队 ADMIN（另有个人订阅） | **不合格**（团队成员不可分享）— 硬排除优先 |
| G5 | 团队 MEMBER（无个人订阅） | 不合格（团队成员不可分享） |
| G6 | 个人套餐过期 | 不合格（回落无有效订阅） |
| G7 | 已有分享档案但降级为团队成员 | 菜单隐藏、`/account/referral` 展示排除文案；档案保留 |

### 8.2 默认返佣比例
| # | 场景 | 期望 |
|---|---|---|
| R1 | 新建分享档案（配置 `referralDefaultRate=0.05`） | 档案 `commissionRate=0.05` |
| R2 | `PlatformPricingConfig` 列缺失（迁移未应用） | 回退 0.05，不报错 |
| R3 | finance-web 反算工具，目标毛利 20% | 统一返佣上限 ≈ 5.9%（视频加量包 25.9% 兜底） |

### 8.3 返佣结算 / 返佣单
| # | 场景 | 期望 |
|---|---|---|
| P1 | 下线在 7 月支付套餐 ¥599 + 充值 ¥100，比例 5% | 计算基数 ¥699，应返 ¥34.95 |
| P2 | 生成 7 月返佣单 | 落库 `PENDING`，金额与预览一致 |
| P3 | 重复「生成」7 月（仍 PENDING） | 覆盖刷新，不产生重复单 |
| P4 | 标记已支付后再「生成」 | 该单被跳过（不覆盖 PAID） |
| P5 | 修改分享人比例后重生成 8 月 | 8 月按新比例；7 月历史单不变 |
| P6 | 导出 CSV | 含周期/分享人/基数/比例/应返/状态 |
| P7 | `monthPeriodRange`（单测） | `2026-07`→[7/1,8/1)；`2026-12`→跨年；非法→null |

### 8.4 冒烟
- finance-web `/admin/referrals`、`/admin/referral-payouts`、`/admin/vip-packages` 均返回 200 且门禁生效。

## 9. 待办 / 后续
- 提现自动打款渠道对接（当前线下打款 + CSV 依据）。
- 如需多级分销 / 防刷（同设备、风控）后续扩展。
