# 数据库结构变更登记

按时间 **倒序或正序一致即可**，建议 **新记录追加在文件底部**。  
大变更可另行新增 `doc/database/YYYY-MM-DD-简短标题.md` 并在此文件首行链接。

---

## 2026-05-16 — 按秒计费（WalletHold）+ 模型校准（ModelCatalog / ModelAlias）

- **迁移目录**：`prisma/migrations/20260516220000_per_second_billing_and_model_calibration/`
- **新枚举**：`WalletHoldStatus`（`HELD` | `SETTLED` | `RELEASED` | `EXPIRED`）；`ModelAliasSource`（9 种来源：云·商品 Code / 计费项 Code / 规格 / 产品名称、内部 toolKey / action / scheme A 模型、price.md 标签、其他）；`AliasConfidence`（`HIGH` | `MEDIUM` | `LOW` | `MANUAL`）。
- **新表**：
  - `WalletHold`——钱包预占用（reservation / hold）。reserve 申请、settle 与 ToolUsageEvent 绑定、release 取消、TTL 自动 EXPIRED。`@@unique([userId, taskKey])` 保证同任务幂等。
  - `ModelCatalog`——标准模型目录。`canonicalKey` 全站唯一，作为对账与账单详情的"模型"主键。
  - `ModelAlias`——别名（来自云 CSV / 内部 toolKey / price.md / 手动），可由自动建议器挂到 catalog；`@@unique([source, aliasValue])`。
- **PlatformConfig 新增字段**：`minBilledVideoSec`（默认 5）、`minBilledImageCount`（默认 1）、`minChargePointsPerInvoke`（默认 1）、`walletHoldDefaultTtlMin`（默认 30）。
- **ToolUsageEvent 新增字段**：`billedVideoSec`（按秒计费实际秒数审计）、`walletHoldId`（与 SETTLED hold 绑定）。
- **应用**：`pnpm db:apply-pending`（事务超时已放宽到 120s，避免多 DDL 集中执行 5s 超时）。
- **逻辑**：详见 `doc/releases/2026-05-16-per-second-billing-and-model-calibration.md`、`doc/product/03-metering-llm-and-tools.md`、`doc/logic/admin-billing-and-refunds.md`。
- **回滚**：开发环境可手动 `DROP TABLE "WalletHold","ModelAlias","ModelCatalog" CASCADE;` + 对应 enum + 从 PlatformConfig/ToolUsageEvent 删字段；生产严禁直接回滚（迁移记录在 `_prisma_migrations`）。

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

## 2026-05-16 — 订阅套餐版本谱系（停旧发新 · 价不可改）

- **迁移目录**：`prisma/migrations/20260516191500_subscription_plan_lineage/`
- **SubscriptionPlan**：新增 `archivedAt DateTime?`、`parentPlanId String?` + self-relation（`PlanLineage`），新增复合索引 `(active, archivedAt)`。
- **原因**：原后台「订阅与充值」直接 `UPDATE SubscriptionPlan.pricePoints` 会破坏老用户「当时订阅价」的溯源；现改为「发布新版本」——旧 plan 改名为 `${slug}__v${ts}` + `active=false` + `archivedAt=now`，新 plan 继承主 slug 并通过 `parentPlanId` 串接历史链。
- **关键不变量**：`Subscription.planId` 仍指向归档 plan，可读到当时的 `pricePoints` / `name` / `toolsNavAllowlist`；前台 `findFirst { slug, active: true }` 自动取到当前版本。
- **应用**：`pnpm db:apply-pending`（或 `pnpm db:deploy`），随后 `pnpm prisma generate`。
- **配套文档**：[`doc/releases/2026-05-16-subscription-plan-lineage.md`](../releases/2026-05-16-subscription-plan-lineage.md)。

## 2026-06-15 — 工具站「视觉实验室」侧栏分组

- **迁移目录**：`prisma/migrations/20260615120000_tool_nav_visual_lab/`  
- **ToolNavVisibility**：新增 `navKey = visual-lab`，`label = 视觉实验室`；`sortOrder >= 4` 的既有行顺延。  
- **应用**：`pnpm run db:deploy`（工具站 `config/nav-tools.ts` 已同步四项子菜单）。

## 2026-05-19 — AI 试衣四模型 ModelCatalog 入库（v1.0.0）

- **迁移目录**：`prisma/migrations/20260519120000_model_catalog_ai_tryon_models/`
- **ModelCatalog**：`aitryon`、`aitryon-plus`、`aitryon-parsing-v1`、`aitryon-refiner`（阿里云百炼；含 vendor 5 列）
- **ModelAlias**：`INTERNAL_SCHEME_A_MODEL` → 上述 canonical
- **原因**：试衣成本模板 v1.0.0；账单 `meta.modelId` 反查与后续 D 表 / 阶梯扣费
- **应用**：`pnpm db:deploy`
- **需求/发布**：[`doc/product/11-ai-tryon-cost-template-v1.0.md`](../product/11-ai-tryon-cost-template-v1.0.md)、[`doc/releases/2026-05-19-ai-tryon-cost-template-v1.0.md`](../releases/2026-05-19-ai-tryon-cost-template-v1.0.md)
- **说明**：目录层；D 表扩展见 `20260519140000_ai_tryon_usage_counter_and_billable`

## 2026-05-19 — AI 试衣累计用量 + D 表 parsing/refiner

- **迁移目录**：`prisma/migrations/20260519140000_ai_tryon_usage_counter_and_billable/`
- **ToolModelUsageCounter**：`userId` + `modelKey` + `periodKey`（UTC 月）+ `quantity`
- **ToolBillablePrice**：`aitryon-parsing-v1` 一行；`aitryon-refiner` 七档阶梯行
- **应用**：`pnpm db:deploy` → `pnpm pricing:realign-from-md:apply` → `pnpm pricing:inspect-billable-vs-md`

## 2026-07-04 — story-web 二期（个人空间 + 引擎模型 + 发布）

- **迁移目录**：`prisma/migrations/20260704120000_story_web_phase2/`（另含 `20260703120000_tool_nav_story_theater` 侧栏菜单）
- **新枚举**：`StoryEngineRole`（LLM / IMAGE / VIDEO）；`StorySpaceTemplateKey`（`CLASSIC_V1`）；`StorySpacePublishStatus`（DRAFT / PUBLISHED）
- **新表**：
  - `StoryEngineModel`——平台维护的可选 AI 引擎（种子含 Gemini、Nano Banana、万相、Veo、可灵等）
  - `StorySpace`——用户漫剧个人空间（`userId` 唯一、`slug` 唯一；可关联 `Product` 发布）
  - `StorySpaceModelSelection`——空间内启用/主模型配置
- **Product**：反向可选 `storySpaceAsPublished`（通过 `StorySpace.publishedProductId`）
- **API**：`/api/story/*`（viewer-session、space、model-config、engine-models、publish）；CORS 由 `STORY_WEB_ORIGINS` 控制
- **应用**：`pnpm db:deploy`

---

## 2026-07-05 — story-web 三期（AI 创作生产线表结构）

- **迁移目录**：`prisma/migrations/20260705120000_story_web_phase3/`
- **新枚举**：
  - `StoryProjectAspect`（`RATIO_16_9` / `RATIO_9_16`）
  - `StoryProjectStatus`（`DRAFT` / `INITIALIZING` / `READY` / `ARCHIVED`）
  - `StoryGenerationKind`（`COVER_IMAGE` / `CHARACTER_AVATAR` / `FRAME_IMAGE` / `FRAME_VIDEO`）
  - `StoryGenerationStatus`（`PENDING` / `SUBMITTED` / `SUCCEEDED` / `FAILED` / `CANCELLED`）
- **新表**：
  - `StoryProject` —— 漫剧项目主表（含 `storyOutline`、`coverImageUrl`、`status`、`deletedAt` 软删；`@@index([userId, deletedAt, updatedAt])`、`@@index([status])`）
  - `StoryCharacter` —— 项目角色（`imagePrompt` 仅含外观/构图/白底，调用 KIE 时由后端实时拼接 `[STYLE]`；`@@index([projectId, sortOrder])`）
  - `StoryStoryboardFrame` —— 分镜（`characterIds: TEXT[]`、`@@unique([projectId, index])`，删除角色时由服务层 `array_remove`）
  - `StoryGenerationTask` —— 统一任务表（覆盖封面/头像/分镜图/分镜视频；`kieTaskId UNIQUE`；`@@index([status, submittedAt])` 支持轮询 worker；`inputPayload/resultPayload JSONB`）
  - `StoryOssCleanupQueue` —— OSS 异步清理队列（`notBefore` 支持"先写新图再删旧图"窗口期，`attempts ≥ 3` 后停手等人工排查）
- **User**：反向关系 `storyProjects StoryProject[]`
- **API（B1+ 即将新增）**：`/api/story/projects/*`、`/api/story/kie/{callback,poll,cleanup}`；CORS 复用 `STORY_WEB_ORIGINS`
- **应用**：`pnpm db:deploy`（已成功，2026-05-22 落地 `tool_mall@sh-postgres-i556nz8q`）
- **逻辑**：详见 `doc/logic/story-ai-pipeline.md`、`story-web/docs/ai/plan.md`、`story-web/docs/ai/todo.md`
- **回滚**：开发环境可手动 `DROP TABLE "StoryOssCleanupQueue",...`; 生产严禁回滚

## 2026-07-11 — Phase D 工具技术服务费（ToolServiceFeePlan / UserToolServicePeriod）

- **迁移目录**：`prisma/migrations/20260711120000_tool_service_fee_plans/`
- **新枚举**：`ToolServicePeriodStatus`（`ACTIVE` | `EXPIRED` | `SUSPENDED`）
- **新表**：
  - `ToolServiceFeePlan`——按 `toolNavKey` 配置月费点数（`monthlyFeePoints`）、展示名、是否可开通
  - `UserToolServicePeriod`——用户 × 工具分组的服务周期（`periodStart` / `periodEnd`、关联钱包流水）
- **种子**：试衣 3000 点/月，其余工具占位定价；`app-history` 0 点
- **应用**：`pnpm run db:deploy`（book-mall 目录）
- **逻辑**：`doc/logic/tool-monthly-service-fee.md`、`doc/plans/2026-phase-d-service-fee-billing.md`

## 2026-07-11 — Phase F Platform SSO 客户端（SsoClient）

- **迁移目录**：`prisma/migrations/20260711140000_sso_client_platform_f/`
- **新表**：`SsoClient`（client_id、redirectUris、allowedNavKeys）
- **SsoAuthorizationCode**：可选 `clientId`
- **应用**：`pnpm run db:deploy`
- **文档**：`doc/tech/platform-api-v1.md`

---

## 2026-06-04 — 电商工具箱（e-commerce-toolkit）

- **迁移目录**：`prisma/migrations/20260604120000_ecommerce_toolkit/`
- **User**：`ecomBillingMode`（`BYOK_SERVICE_FEE` | `PLATFORM_METERED`，默认 BYOK）
- **新表**：`EcomAsset`（用户电商资产 OSS URL）
- **枚举**：`GatewayClientSource` 增加 `E_COMMERCE`
- **种子**：`ToolServiceFeePlan`（`e-commerce-toolkit`）、`ToolBillablePrice`（`ecom-toolkit__*`）
- **应用**：`pnpm run db:deploy`
- **文档**：`doc/product/e-commerce-toolkit.md`

## 2026-06-05 — 电商工具箱 · 微剧情分镜故事版（M5）

- **迁移目录**：`prisma/migrations/20260605120000_ecom_storyboard/`
- **新表**：`EcomStoryboardProject`（聊天、分镜 JSON、PNG/HTML URL、视频资产关联）
- **种子**：`ToolBillablePrice`（`ecom-toolkit__storyboard` chat / video）
- **应用**：`pnpm run db:deploy`

<!-- 模板（复制使用）
## YYYY-MM-DD — 标题
- **迁移/脚本**：
- **表/字段**：
- **原因**：
- **回滚**：
-->
