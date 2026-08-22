# 数据库结构变更登记

按时间 **倒序或正序一致即可**，建议 **新记录追加在文件底部**。  
大变更可另行新增 `doc/database/YYYY-MM-DD-简短标题.md` 并在此文件首行链接。

---

## 2026-08-21 — 全站访问统计（SiteTrafficDaily / SiteTrafficIpDaily）

- **迁移目录**：`prisma/migrations/20260821200000_platform_traffic_daily/`
- **新表**：
  - `SiteTrafficDaily`——按 CST 日 + appKey 汇总 PV；`@@unique([dateCst, appKey])`。
  - `SiteTrafficIpDaily`——按 CST 日 + appKey + IP 明细（hitCount、首末访）；UV 由 distinct IP 计数；`userId` 可选关联 `User`。
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`。
- **逻辑**：详见 `doc/product/26-platform-traffic-analytics.md`。

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

## 2026-08-22 — 首页静态快照 CMS（Phase 1）

- **迁移目录**：`prisma/migrations/20260822233000_static_page_snapshot/`
- **新表**：`StaticPageSnapshot`（`pageKey` + `dateKey` 唯一；`payload` Json）、`StaticSnapshotGenerationRun`（生成流水）
- **枚举**：`StaticSnapshotStatus`、`StaticSnapshotTrigger`
- **逻辑**：Cron/管理后台/CLI 预生成首页快照；ISR 只读；详见 `doc/product/site-home-static-snapshot.md`
- **应用**：`pnpm db:apply-pending`，`pnpm db:generate`

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

## 2026-07-16 — Gen-HotCold-R2：动静分离 / 投影计数 / 历史归档

- **迁移目录**：
  - `prisma/migrations/20260716130000_genhotcold_partial_indexes/`（Phase 0 · 在飞任务 / RUNNING 日志**部分索引**，裸 SQL；Prisma 无法表达 WHERE）。
  - `prisma/migrations/20260716140000_gateway_stats_counter/`（Phase 2 · 新表 `GatewayStatsCounter`）。
  - `prisma/migrations/20260716150000_genhotcold_archive_tables/`（Phase 5A · 新表 `GatewayRequestLogArchive`、`CreditLedgerArchive`，`LIKE` 克隆主表结构 + 精简索引 + `archivedAt`）。
- **新表**：
  - `GatewayStatsCounter`（`@@id([scopeKey, bucket])`）——状态页卡片投影计数。`global` 行由 `createRequestLog`/`finalizeRequestLog` 增量 bump 维持在飞实时；任意 scope 行作为短 TTL 自愈缓存（`computedAt` 过期即全量重算回填）。真相仍是 `GatewayRequestLog`，由 TTL 重算 + `gateway:stats-reconcile` 纠偏。
  - `GatewayRequestLogArchive` / `CreditLedgerArchive`——只读历史归档（无外键）。终态/过期数据从主表事务内 `INSERT…ON CONFLICT DO NOTHING` + `DELETE` 搬迁，按 id 幂等。
- **部分索引**（裸 SQL，不在 Prisma schema）：
  - `CanvasGenerationTask_inflight_queuedAt_idx` / `StoryGenerationTask_inflight_queuedAt_idx`（status, queuedAt）WHERE status IN(QUEUED,DISPATCHING,PENDING,SUBMITTED）
  - `*_submitted_lastPolledAt_idx`（lastPolledAt）WHERE status='SUBMITTED'
  - `GatewayRequestLog_running_submittedAt_idx`（submittedAt）WHERE status='RUNNING' AND externalTaskId IS NOT NULL
- **脚本**：`gateway:stats-reconcile`（投影纠偏 + 清陈旧签名缓存，支持 `--dry-run`）；`hotcold:archive` / `hotcold:archive:dry-run`（归档搬迁，`--gateway-days` / `--ledger-days` / `--only` / `--batch`）。
- **连接/读路由**（Phase 6，非 schema）：所有环境注入 `connection_limit`；新增只读副本 `DATABASE_REPLICA_URL`，仪表盘聚合走 `prismaRead`（未配置则回退主库）。
- **应用**：`pnpm --dir book-mall db:deploy`（迁移均 `IF NOT EXISTS`/幂等，非破坏）。
- **回滚**：开发环境可 `DROP TABLE "GatewayStatsCounter","GatewayRequestLogArchive","CreditLedgerArchive";` + `DROP INDEX` 上述部分索引；生产严禁直接回滚（记录在 `_prisma_migrations`）。归档表删除前须确认数据已无需保留。
- **逻辑**：详见 `doc/releases/2026-07-16-gen-hotcold-r2.md`、`docs/全站架构图与配置表.md` §7。

---

## 2026-06-23 — PgBouncer 就绪：datasource `directUrl`（迁移直连）

- **schema 变更（非迁移）**：`prisma/schema.prisma` 的 `datasource db` 新增 `directUrl = env("DIRECT_DATABASE_URL")`。
  - 运行时查询走 `DATABASE_URL`（正式经 PgBouncer:6432，`pgbouncer=true`）；`prisma migrate` / `db:deploy` 自动改走 **`DIRECT_DATABASE_URL` 直连 CDB:24155**（transaction 池不支持迁移所需会话特性）。
  - **无破坏**：运行时 PrismaClient **不读** directUrl（实测缺该 env 仍正常服务）；仅 CLI 迁移使用。无 PgBouncer 时填同库直连串即可，行为不变。
- **配置**：`book-mall/.env.local`、`book-mall/.env.example`、`deploy/tencent/book-mall.env.example` 已补 `DIRECT_DATABASE_URL`；dev 连接池默认 10→30。
- **部署文件**：`deploy/tencent/pgbouncer/`（`pgbouncer.ini` transaction 模式 + 空闲回收、`docker-compose.yml`、`userlist.txt.example`）。
- **应用侧抗压**（同批，非 schema）：DB 重试加墙钟预算 `DB_RETRY_BUDGET_MS`（默认 8s，止住池超时叠加到分钟级）；DISPATCHING 活锁修复（按 `queuedAt` 年龄回收无 vendor id 的孤儿任务）；`background-video-tasks` 读端点动静分离（终态查询限近 6h、canvas JSON 懒加载）。
- **回滚**：移除 `directUrl` 行并删除各 env 的 `DIRECT_DATABASE_URL` 即恢复;迁移历史不受影响（未新增迁移）。

---

## 2026-08-15 — 电商模板区 / 模特库 catalog（Prisma）

- **迁移目录**：`prisma/migrations/20260815010000_ecom_template_and_model_catalog/`
- **新表**：
  - `EcomTemplateCatalogEntry`——电商工具箱模板区运营 catalog。保留原 `id/category/mediaKind/title/hot/ossUrl/thumbUrl`，并扩展封面/主图/参考图/prompt/负向词/默认模型与参数/海报/排序；`deletedAt` 软删。
  - `EcomModelLibraryEntry`——模特库（`name/gender/age/ossUrl/sortOrder` + 软删）。
- **种子**：`pnpm ecom:seed-catalog` 从 `e-commerce-toolkit` 的 `catalog.json` upsert；JSON / CLI 仅作种子与导入备份，运行时用户 GET 优先读库。
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`。
- **管理入口**：Book `/admin/templates?tab=ecom`。
- **回滚**：开发环境可 `DROP TABLE "EcomTemplateCatalogEntry","EcomModelLibraryEntry";`；生产严禁直接回滚。

---

## 2026-08-15 — 我的 AI 空间（已落库）

- **迁移目录**：`prisma/migrations/20260815020000_ai_space/`
- **产品文档**：[`doc/product/我的AI空间.md`](../product/我的AI空间.md)
- **新表**：
  - `AiSpacePin`——作品墙指针。只存 `{ sourceApp, sourceType, sourceId, sortOrder, caption }`，`@@unique([userId, sourceType, sourceId])`；**禁止**缓存 `prompt` / `ossUrl` / `thumbnailUrl`，展示字段读时 resolve 源记录。
  - `AiSpaceDigitalHuman`——数字人形象库（Book 真源，全应用引用 id）。含 `avatarImageUrl` / `status`（`active` | `inactive` | `detect_failed`）；尺寸与 `wan2.2-s2v-detect` 预检结果存 `meta`（`width` / `height` / `detect.{checkPass,humanoid,message,checkedAt,imageUrl}`），换图后 `imageUrl` 不匹配即视为未检测，**无需迁移**。
  - `AiSpaceAudioAsset`——统一音频库（Book 真源）。`sourceType` 覆盖 `upload` / `tts` / `voice_clone` / `voice_changer` / `sound_effect` / `music`；`durationSec` 由 ffprobe 探测，合成台 20 秒门禁依赖该字段。
  - `AiSpaceVideoMaterial`——视频创作库，只存 **用户上传** 与 **合成成片**（`sourceKind = upload | compose_output`）；各应用已发布视频经 `AiSpacePin(kind=video)` 引用展示，不复制。
  - `AiSpaceComposeTask`——数字人口播合成任务。状态 `pending → generating_human → composing → completed`（失败 `failed`），串联 Gateway `wan2.2-s2v` 与 `MediaRenderJob`。
- **原则**：Pin 仅指针；数字人/音频为 **Book 真源**，全应用引用 ID；删源 cascade Pin（`cascadeDeletePinsBySource`）；删素材前经 `/api/platform/v1/ai-space/refs/check` 检测跨应用引用。
- **非 schema 同批变更**：`MediaTimelineV1` 新增可选 `composite`（背景 / 音轨 / overlay / 字幕），走 `render-ffmpeg.runCompositeRender`；`MediaRenderJob.sourceApp` 复用 `api`，未新增枚举值。
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`。
- **回滚**：开发环境可 `DROP TABLE "AiSpaceComposeTask","AiSpaceVideoMaterial","AiSpaceAudioAsset","AiSpaceDigitalHuman","AiSpacePin";`；生产严禁直接回滚。

---

## 2026-08-16 — 我的 AI 空间 · 口播分镜脚本（已落库）

- **迁移目录**：`prisma/migrations/20260816140000_ai_space_broadcast/`
- **产品文档**：[`doc/product/ai-space-broadcast-script.md`](../product/ai-space-broadcast-script.md) · [`doc/product/我的AI空间.md`](../product/我的AI空间.md) §4.5
- **新表**：
  - `AiSpaceBroadcastProject`——口播项目壳（`sourceKind` / `sourceText` / `brief` / `activeScriptId` / `status`）
  - `AiSpaceBroadcastScript`——版本化脚本头（`projectId` + `version` 唯一）
  - `AiSpaceBroadcastShot`——镜级行（台词 / 时间 / `presenter` & `visual` JSON / 素材 id 引用）
  - `AiSpaceBroadcastRenderJob`——总拼接任务（`finalVideoUrl` / `status`）
- **非 schema**：合成台 `ComposeProgressStep[]` 分步进度；Tab `?tab=broadcast`
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`

---

## 2026-08-15 — 手伴创作（线稿 → 潮玩盲盒 IP 全案，已落库）

- **迁移目录**：`prisma/migrations/20260815120000_ecom_hand_craft_project/`
- **产品文档**：[`doc/product/e-commerce-toolkit.md`](../product/e-commerce-toolkit.md) §手伴创作 · [`doc/手伴/skill.md`](../手伴/skill.md)（助手 system prompt 真源）
- **新表**：
  - `EcomHandCraftProject`——字段照 `EcomSeedVideoProject`（`userId` / `title` / `module @default("hand-craft")` / `status` / `brief` / `settings` / `references` / `chatHistory` / `plan` / `meta` + 租户三字段），索引 `[userId, module, updatedAt]`、`[tenantId, visibility, updatedAt]`。
  - `plan.steps` 为 10 步产出：`generate` 步存 `slots[]`（index / title / prompt / imageUrl / assetId），`compose` 步存 `outputs[]`（页序 / 标题 / 拼版 PNG）。结构见 `lib/ecom/ecom-hand-craft-types.ts`，模板表见 `lib/ecom/ecom-hand-craft-steps.ts`。
  - `meta.workflow.heroLockedUrl`——第 1 步定稿的主形象 OSS URL，是后续 9 步的一致性锚点（每步生图第 1 张参考图恒为它）。换主线稿会重置 `plan` 与该字段。
- **不新增表**：成图直接落 `EcomAsset(module: "hand-craft")`；第 8–10 步拼版 PNG 由浏览器 html2canvas 抓图后同样落 `EcomAsset`。
- **计费**：不新增价目行。套件月费仍走 `e-commerce-toolkit` navKey（`ecom-toolkit__` 前缀自动覆盖），厂商成本经 Gateway；`ToolBillablePrice` 已于 `20260709120000_drop_tool_billable_price` 删除，无按次价目表可写。
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`。
- **回滚**：开发环境可 `DROP TABLE "EcomHandCraftProject";`；生产严禁直接回滚。

---

## 2026-08-16 — 我的 AI 空间 · 作品墙自由画布（已落库）

- **迁移目录**：`prisma/migrations/20260816160000_ai_space_canvas/`
- **产品文档**：[`doc/product/AI 空间功能设计文档.md`](../product/AI%20空间功能设计文档.md) · [`doc/product/我的AI空间.md`](../product/我的AI空间.md)
- **新枚举**：
  - `AiSpacePageTemplate`（`MAGAZINE` | `PORTFOLIO` | `BENTO` | `TIMELINE` | `MINIMAL`）——5 套整页版式
  - `AiSpacePagePublishStatus`（`DRAFT` | `PUBLISHED`）——形状对齐现网 `StorySpace`
- **新表**：
  - `AiSpacePage`——空间页。`userId` **unique**（v1 一人一页）、`slug` unique 供 `/space/{slug}` 公开访问；`title` / `bio` / `templateKey` / `theme`（背景与主色）/ `publishStatus` / `publishedAt`。
  - `AiSpaceBlock`——画布块 / 挂件。`blockType`（12 种，取值真源 `lib/ai-space/space-blocks/types.ts`）、`sizeTier`（`sm` | `portrait` | `wide` | `lg` | `full`）、`layoutX/Y/W/H/Z` 为 **12 列栅格单位（非像素）**，与 react-grid-layout 的 `x/y/w/h` 一一对应；`mobileOrder` 为窄屏单列顺序；`config` / `content` 由服务端 `parseConfig` / `parseContent` 白名单规范化后落库。冗余 `userId` 便于鉴权过滤。
  - `AiSpaceBlockRef`——块引用的资产 0..N（单图 1 条、图片墙至多 60 条）。`sourceApp` / `sourceType` / `sourceId` 与 `AiSpacePin` **同一套取值**，读时复用 `lib/ai-space/pin-resolvers.ts` 联邦解析；`slotKey` 承载命名槽位（`before` / `after`、`face` / `full_body` / `outfit` / `extra`）。
- **`AiSpaceBlockRef` 刻意不加 unique**：同一资产可同时出现在封面块与图片墙里；保留 `@@index([sourceType, sourceId])` 供删源级联。
- **`AiSpacePin` 零改动**：语义由「已展示在墙上」调整为「已收进空间的素材」（编辑器左侧素材抽屉），5 处子应用写入与 7 处 `cascadeDeletePinsBySource` 调用点均未修改。
- **删源级联**：`cascadeDeletePinsBySource` 现同步调用 `cascadeDeleteBlockRefsBySource` 清 ref，**块本身保留**并渲染「素材已删除」占位——删一张图不应导致整页布局塌陷。`pins/check` / `refs/check` 及三个素材库的 `?checkRefsFor=` 返回补 `blockRefCount`。
- **硬上限（服务端校验）**：单页块数 60、单页总 refs 500、单个 `gallery` refs 60、`video_playlist` refs 20。
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`。
- **回滚**：开发环境可 `DROP TABLE "AiSpaceBlockRef","AiSpaceBlock","AiSpacePage" CASCADE;` + `DROP TYPE "AiSpacePagePublishStatus","AiSpacePageTemplate";`；生产严禁直接回滚。

---

## 2026-08-16 — 我的 AI 空间 · 全局资产库（**无 schema 变更**）

- **迁移**：无。资产源扩展纯代码层，`sourceType` 是 `AiSpacePin` / `AiSpaceBlockRef` 的普通字符串列，新增取值不需要 DDL。
- **产品文档**：[`doc/product/AI 空间功能设计文档.md`](../product/AI%20空间功能设计文档.md) §11
- **新增 `sourceType` 取值（8 种，真源 `lib/ai-space/ai-space-pin-types.ts`）**：
  `story_character`、`story_frame_image`、`story_frame_video`（`StoryCharacter` / `StoryStoryboardFrame`，归属经 `project.userId`）；
  `project_asset`（`ProjectAsset`，归属 `ownerUserId`，跳过纯文字类 kind）；
  `canvas_task`（`CanvasGenerationTask`，仅 `SUCCEEDED` 且 `ossUrl` 非空）；
  `aifit_model`、`aifit_closet`（`AiFitCustomModel` / `AiFitClosetItem`）；
  `qr_template`（`QrTemplate`，排除 `isPlatformCatalog`）。
- **读路径**：`pin-resolvers.ts` 由「一源一 resolver」重构为「一源一适配器」（`SOURCE_ADAPTERS`），同一段 `where` 同时服务按 id 解析与按最近列举；新增聚合服务 `ai-space-asset-library.ts`（单源 24 条 / 合并 240 条 / 并发 4）。
- **删源级联新增接入点**：`deleteProjectAsset`、`deleteUserQrTemplate` / `deleteAdminUserQrTemplate`、AI 试衣衣柜 `DELETE`。`story_*` / `canvas_task` / `aifit_model` 的删除路径在子应用侧，暂未接入；孤儿 Pin 读时静默跳过，画布块渲染「素材已删除」占位。
- **注意**：`aifit_model` 的媒体是 base64 Data URL，经鉴权代理路由输出，且 `AI_SPACE_PIN_SOURCE_PUBLIC_SAFE=false`——公开页跳过该类引用。

---

## 2026-08-19 — 模型运营中心（sourceLabel + AppModelShelf）

- **迁移目录**：`prisma/migrations/20260819120000_model_operations_center/`
- **ModelCatalog**：新增可空字段 `sourceLabel`（用户选模时展示的「来源」标签）
- **新表 `AppModelShelf`**：按 `appTag` + `sceneKey` + `canonicalModelKey` 管理应用/场景级上架与排序；`AppModelShelfStatus`（`ACTIVE` | `HIDDEN` | `DEPRECATED`）
- **产品文档**：`doc/product/model-operations-center.md`
- **Seed**：`pnpm gateway:seed-model-ops`（回填 sourceLabel 与全局 AppModelShelf）

---

## 2026-08-21 — 管理后台待做功能（AdminPendingFeature）

- **迁移目录**：`prisma/migrations/20260821210000_admin_pending_feature/`
- **新表**：`AdminPendingFeature`——title、description、docPath（仓库相对路径）、completed、sortOrder。
- **页面**：`/admin/pending-features`（Book 运营 → 待做功能）。
- **种子**：`pnpm exec dotenv -e .env.local -- tsx scripts/seed-admin-pending-features.ts`
- **应用**：`pnpm db:apply-pending` + `pnpm db:generate`。

---

<!-- 模板（复制使用）
## YYYY-MM-DD — 标题
- **迁移/脚本**：
- **表/字段**：
- **原因**：
- **回滚**：
-->
