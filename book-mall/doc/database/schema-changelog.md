# 数据库结构变更登记

按时间 **倒序或正序一致即可**，建议 **新记录追加在文件底部**。  
大变更可另行新增 `doc/database/YYYY-MM-DD-简短标题.md` 并在此文件首行链接。

---

## 2026-05-11 — 工具站 SSO 一次性授权码

- **迁移目录**：`prisma/migrations/20260511180000_sso_tools_authorization_code/`  
- **新表**：`SsoAuthorizationCode`（`code` 唯一、`expiresAt`、`consumedAt`，关联 `User`）。  
- **应用**：`pnpm run db:deploy`。  
- **逻辑**：详见 `doc/logic/tools-sso-session.md`、`doc/tech/tools-sso-environment.md`。

## 2026-05-12 — 计费配置扩展与提现审核

- **迁移目录**：`prisma/migrations/20250512120000_billing_refunds/`  
- **PlatformConfig**：`llmInputPer1kTokensMinor`、`llmOutputPer1kTokensMinor`、`toolInvokePerCallMinor`、`usageAnomalyRatioPercent`。  
- **Order**：`refundedAt`（订阅提现完成后标记，避免重复办理）。  
- **新表**：`WalletRefundRequest`、`SubscriptionRefundRequest`，枚举 `RefundRequestStatus`。  
- **应用**：`pnpm run db:deploy`。

## 2026-05-11 — 用户角色 `User.role`

- **迁移目录**：`prisma/migrations/20250511120000_add_user_role/`  
- **变更**：枚举 `UserRole`（`USER` | `ADMIN`）；`User.role` 默认 `USER`。  
- **运营**：在 `.env.local` 配置 `ADMIN_EMAILS`（逗号分隔）后执行 `pnpm db:seed` 提升对应账号；**须重新登录**后 JWT 才带 `ADMIN`。  
- **入口**：前台导航「管理后台」→ `/admin`（middleware 拦截非管理员）。

## 2026-05-11 — `init_ai_mall` 首版表结构

- **迁移目录**：`prisma/migrations/20250511040000_init_ai_mall/`  
- **表**：NextAuth（`User`, `Account`, `Session`, `VerificationToken`）、`PlatformConfig`、`Wallet`、`WalletEntry`、`SubscriptionPlan`、`Subscription`、`Order`  
- **枚举**：`WalletEntryType`、`SubscriptionInterval`、`SubscriptionStatus`、`OrderType`、`OrderStatus`  
- **回滚**：开发环境可 `DROP SCHEMA public CASCADE` 后重建（**生产禁止**）；生产需逆向迁移或备份后操作。  
- **本机应用**：`pnpm run db:deploy`（依赖 `.env.local` 中 `DATABASE_URL`），然后 `pnpm run db:seed`。当前团队环境使用 Neon 默认库 **`neondb`** 亦可。

## 2026-05-10 — 初始化

- **库名（逻辑）**：文档曾用 `ai_mall`；**Neon 控制台默认 database 多为 `neondb`**，将 `DATABASE_URL` 指向实际库名即可（见 `doc/tech/stack-and-environment.md`）。  
- **说明**：原占位；**2026-05-11** 起已有正式迁移，见上条。

## 2026-05-10 — 产品分类与产品（知识型 / 工具型）

- **迁移目录**：`prisma/migrations/20260510120000_products/`  
- **新表**：`ProductCategory`（`parentId` 自关联子分类）、`Product`。  
- **枚举**：`ProductKind`、`ProductTier`、`ProductStatus`。  
- **首页推荐**：`Product.featuredHome`、`featuredSort`（仅 `PUBLISHED` 且勾选后在首页展示）。  
- **应用**：`pnpm run db:deploy`，再 `pnpm db:seed`（会写入默认「AI 课程」「AI 应用」分类）。

## 2026-05-12 — 课程课时进度 `CourseLessonProgress`

- **迁移目录**：`prisma/migrations/20260512140000_course_lesson_progress/`  
- **新表**：`CourseLessonProgress`（用户 × `courseSlug` × `lessonIndex` 唯一；记录完成时间）。  
- **应用**：`pnpm run db:deploy`。

## 2026-05-12 — 订阅计划工具套件分组白名单

- **迁移目录**：`prisma/migrations/20260512120000_subscription_plan_tools_nav_allowlist/`  
- **SubscriptionPlan**：`toolsNavAllowlist`（`TEXT[]`，默认空数组；**空表示订阅期内可使用套件内全部分组**）。  
- **逻辑**：工具站 JWT / introspect 下发 `tools_nav_keys`；详见 `doc/releases/v2.0-tools-subscription-courses.md`。  
- **应用**：`pnpm run db:deploy`。

## 2026-05-13 — 钱包充值入账统一与「充送」meta（无新迁移）

- **迁移**：无新增 SQL；依赖既有 `Order.meta`（JSON）、`WalletEntry`。
- **逻辑**：`lib/wallet-topup-fulfill.ts` 统一「加余额 + 订单 + 流水」；支持本金 + 赠送拆分，`Order.meta.topup` 记 `{ paidAmountPoints, bonusPoints, creditedTotalPoints }`；有赠送时同一 `orderId` 可对应 **两条** `RECHARGE`。
- **文档**：`doc/product/points-wallet-topup-spec.md`（影响面、遗留、财务注意点）。
- **应用**：拉代码即可；真实支付接入时在 notify 内调用 `fulfillWalletTopupCredits`。
- **后续**：**2026-05-14** 起充送产品路径以 **优惠券模板 + 领取 + `rechargeCouponId` 核销** 为主（见上条与本 spec 最新版）。

## 2026-05-14 — 充值优惠模板与用户优惠券（充送对账）

- **迁移目录**：`prisma/migrations/20260514143000_recharge_promo_coupons/`  
- **新枚举**：`RechargeCouponStatus`（`UNUSED` | `REDEEMED` | `EXPIRED`）。  
- **新表**：`RechargePromoTemplate`（可调「充 N 送 M」、领取时间窗、每用户领取上限、领取后有效天数等）；`UserRechargeCoupon`（领取快照、`expiresAt`、核销后 `orderId` 唯一关联 `Order`）。  
- **逻辑**：`lib/recharge-coupon.ts`（领取、过期、列表）；`fulfillWalletTopupCredits` 支持 `rechargeCouponId`；`Order.meta.topup.rechargeCouponId` 对账。  
- **前台**：`/account/recharge-promos`；收银台 `/pay/mock-topup` 传 `rechargeCouponId`。  
- **后台**：`/admin/finance/promo-templates`。  
- **应用**：`pnpm run db:deploy`。

## 2026-06-15 — 工具站「视觉实验室」侧栏分组

- **迁移目录**：`prisma/migrations/20260615120000_tool_nav_visual_lab/`  
- **ToolNavVisibility**：新增 `navKey = visual-lab`，`label = 视觉实验室`；`sortOrder >= 4` 的既有行顺延。  
- **应用**：`pnpm run db:deploy`（工具站 `config/nav-tools.ts` 已同步四项子菜单）。

<!-- 模板（复制使用）
## YYYY-MM-DD — 标题
- **迁移/脚本**：
- **表/字段**：
- **原因**：
- **回滚**：
-->
