# 2026-05-16 订阅套餐版本谱系（停旧发新 · 价不可改）

> 状态：**已上线（迁移已落、UI 已替换、tsc 已过）**  
> 范围：**book-mall**（主站后台 `/admin/billing` 与订阅价取数链路）  
> 起因：后台「订阅与充值」原地修改月/年订阅价后无任何成功提示，且**直接 UPDATE `SubscriptionPlan.pricePoints`** 会破坏老用户「当时订阅价」的溯源——老订单的 `Subscription.planId` 仍指向同一 plan，但该 plan 的字段已被覆盖。

---

## 1. 设计原则

| 项 | 旧 | 新 |
|----|----|----|
| 改价方式 | 在后台 form 直接 UPDATE `SubscriptionPlan.pricePoints` | **不可改**。仅可「发布新版本」——把旧 plan 归档 + 新建新 plan 持有新价 |
| 老用户溯源 | 破坏（旧 plan 价已被覆盖） | 完整：`Subscription.planId` 仍指向归档 plan，可读到当时的 `pricePoints` / `name` / `toolsNavAllowlist` |
| 主 slug | 旧 plan 占用 `monthly` / `yearly` | **让位**给新 plan，旧 plan 改为 `monthly__v<时间戳>` / `yearly__v<时间戳>` 释放主 slug |
| 前台买入 | `findFirst { slug: "monthly", active: true }` | **不变**——新版本继承主 slug + active=true，旧版本 active=false |
| 保存提示 | 无（form action 直返） | 客户端 `useActionState` + banner，**成功 / 失败均显式回显** |
| 工具白名单 | 允许在任何 plan 上修改 | **仅允许在 active 且未归档的 plan 上修改**；已归档 plan 锁死，保证溯源 |

---

## 2. 数据模型

### 2.1 迁移：`prisma/migrations/20260516191500_subscription_plan_lineage/`

```sql
ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "parentPlanId" TEXT;

ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "SubscriptionPlan_parentPlanId_fkey"
  FOREIGN KEY ("parentPlanId") REFERENCES "SubscriptionPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SubscriptionPlan_active_archivedAt_idx"
  ON "SubscriptionPlan"("active", "archivedAt");
```

### 2.2 Prisma schema 增量

```prisma
model SubscriptionPlan {
  // …既有字段…
  archivedAt   DateTime?
  parentPlanId String?
  parent       SubscriptionPlan?  @relation("PlanLineage", fields: [parentPlanId], references: [id], onDelete: SetNull)
  successors   SubscriptionPlan[] @relation("PlanLineage")

  @@index([active, archivedAt])
}
```

> 说明：`slug` 仍是 `@unique`；旧版本通过让位主 slug 来避免冲突。`parentPlanId` 把同一族（月 / 年）历次版本串成一条单向链：**当前 active → parent → grandparent → …**。

### 2.3 部署

```bash
pnpm db:apply-pending   # 或 pnpm db:deploy（生产）
pnpm prisma generate
```

---

## 3. Server actions（`app/actions/billing.ts`）

### 3.1 删除

- `updateSubscriptionPlanPrice(formData)` —— 原地改价，**已删除**。

### 3.2 新增

**`publishNewSubscriptionPlanVersion(prev, formData)`**

- 入参：`planId`（必须为当前 active 且未归档的 plan）、`newPricePoints`、`confirm === "yes"`（前端二次确认）
- 校验：planId 存在 & active & 未归档；新价为非负整数且 ≠ 当前价
- 事务（`prisma.$transaction`）：
  1. 旧 plan：`slug → ${slug}__v${YYYYMMDDHHMMSS}`、`active=false`、`archivedAt=now`
  2. 新 plan：`slug=旧 slug`、`name=旧 name`、`interval=旧 interval`、`pricePoints=新价`、`active=true`、`toolsNavAllowlist=旧 allowlist`、`parentPlanId=旧 id`
- 副作用：`revalidatePath('/admin/billing' | '/subscribe' | '/pricing-disclosure' | '/')`
- 返回：`{ kind: "ok" | "error", message }`

### 3.3 统一返回结构

所有 admin/billing form action 改为 `(prev, formData) → BillingActionState`，可被 `useActionState` 消费：

```ts
export type BillingActionState =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };
```

涉及：`updatePlatformBillingConfig`、`publishNewSubscriptionPlanVersion`、`updateSubscriptionPlanToolsAllowlist`、`extendActiveSubscription`。

### 3.4 工具白名单的边界

`updateSubscriptionPlanToolsAllowlist` 增加守卫：**已归档 plan 拒绝修改**。否则历史版本工具范围被改写，仍会破坏老用户的"当时权益快照"。

---

## 4. 后台 UI（`app/admin/billing/`）

| 文件 | 角色 |
|------|------|
| `page.tsx` | 服务端：读 plans + 按 `parentPlanId` 上溯收集每个 active plan 的历史版本；订单/订阅计数等 |
| `feedback-banner.tsx` | 客户端通用 banner（成功用 `emerald`，失败用 `destructive`） |
| `platform-config-form.tsx` | 计费配置：`useActionState`，按钮 pending 文案、保存后 banner |
| `subscription-plan-card.tsx` | 单个 active plan 卡：当前价展示 + 「发布新价（停旧发新）」表单（带二次确认复选框；未勾选则按钮禁用）+ 工具白名单表单 + 「历史版本」`<details>` 折叠表 |
| `extend-subscription-form.tsx` | 手动续期：banner 显示「已为 …@… 延长 N 天，新到期：…」 |

### 4.1 「发布新价」交互

1. 输入新点数（placeholder 为当前价）
2. **必须**勾选「我已知晓：旧版本将归档，**无法恢复**；老用户订阅仍可溯源旧价。」按钮才可点
3. 提交后：成功 banner 展示新旧 slug；失败 banner 显示原因（如「新价与当前价相同」「该套餐已归档」）

### 4.2 「历史版本」折叠表

每个 active plan 卡底部 `<details>`：归档 slug / 归档时间 / 当时价（点 & ≈ 元）/ 关联订阅数。
另在主页面底部「未挂在当前链上的归档套餐」一并兜底展示游离归档。

---

## 5. 调用链兼容性核对

| 路径 | 取数方式 | 是否受影响 |
|------|----------|------------|
| `components/layout/sections/pricing.tsx` | `findFirst { slug: "monthly"/"yearly", active: true }` | ✅ 新版本继承主 slug，自动指向新价 |
| `app/(site)/subscribe/page.tsx` | 同上 | ✅ |
| `app/(site)/pricing-disclosure/page.tsx` | `findMany` | ✅ 仅过滤 active 即得当前价 |
| `lib/apply-mock-subscription.ts` | `findUnique { slug }` | ✅ 主 slug 由 active plan 持有 |
| `app/(site)/pay/mock-subscribe/page.tsx` | `findUnique { slug }` | ✅ |
| `scripts/dev-reset-user-billing.ts` | `findUnique { slug }` | ✅ |
| `prisma/seed.ts` | `upsert { slug }` | ✅ 仅在 active plan 上 upsert，归档版本不被改名复活 |

> **关键不变量**：`Subscription.planId`（外键）是溯源根。任何对 plan 字段的"覆盖式"修改都会破坏溯源 → 因此除 active plan 上的工具白名单外，**禁止覆盖式 update**。

---

## 6. 验收清单

- [x] 迁移 `20260516191500_subscription_plan_lineage` 已应用（`pnpm db:apply-pending` 输出 `applied …`）
- [x] `pnpm prisma generate` 已重新生成
- [x] `pnpm tsc --noEmit` 干净通过
- [ ] 后台 `/admin/billing`：
  - 发布新价后顶部 banner 显示「已发布新版本：…（slug）当前价 N 点；旧版本归档为 …__v…」
  - 同卡片底部「历史版本」出现新归档行
  - 不勾选确认框时「发布新版本」按钮置灰
  - 已归档套餐尝试改工具白名单 → 失败 banner
- [ ] 前台 `/`、`/subscribe`、`/pricing-disclosure` 显示新价
- [ ] 老用户 `Subscription`（仍指向归档 plan）查询能读到当时价

---

## 7. 后续可选优化

- 卡片右上角增加「下一步：账单 / 用户清单」入口（按 plan 维度跳转到使用该 plan 的订阅明细）。
- 「发布新价」时可同步调整 `toolsNavAllowlist`（同一事务），便于"调价 + 权益"打包发布。
- 订阅价的历史曲线可视化（按 plan family slug 拉时间线）。

---

## 8. 相关文档

- 数据库变更：[`doc/database/schema-changelog.md`](../database/schema-changelog.md)（2026-05-16 条目）
- 逻辑文档：[`doc/logic/admin-billing-and-refunds.md`](../logic/admin-billing-and-refunds.md)（5.3 已同步）
- 产品总览：[`doc/product/05-admin.md`](../product/05-admin.md) §5.3
