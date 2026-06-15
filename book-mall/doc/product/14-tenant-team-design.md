# 租户 / 团队体系 — 完整设计

> 状态：设计稿（待评审 → 开发）
> 创建：2026-06-08
> 关联：
> - 实施总纲 `doc/plans/2026-06-08-gateway-multi-credential-and-tenant-rollout.md`（Sprint 0 + 轨道 A~E）
> - 已落地的统一积分计费 `.cursor/plans/unified-credit-billing_*.plan.md`（本设计的「财务地基」）
> - 平台联邦约束 `doc/product/12-platform-app-federation.md`
> - 配套使用手册 `doc/product/15-team-usage-manual.md`

本设计目标：**让「团队/公司」可真正开通、可控席位、可共享资源、可精细对账**。
个人用户（personal）行为保持不变；团队是叠加层。

---

## 0. 名词与角色

| 名词 | 含义 |
|------|------|
| **租户 Tenant** | 计费与资源归属的最小主体。每个 Book 用户至少属于一个租户 |
| **personal 租户** | 1 用户 = 1 个人租户（系统自动创建，无感） |
| **team 租户** | 主账号开通团队后创建；下挂多个成员（子账号），共享积分池与公共资产 |
| **席位 Seat** | 团队中「一个可生成的成员位」。席位数 = 计费单位（紫色按席位变化），与成员一一占用 |
| **角色 RoleType** | `personal_user` / `team_owner`（创建者）/ `team_admin`（管理员）/ `team_member`（普通成员） |

> 「工作室 / 公司」是 team 租户在套餐档（标准…至尊）与席位规模上的不同表现，**不是独立实体类型**，避免模型膨胀。

---

## 1. 数据模型（Prisma · book-mall）

### 1.1 新增

```prisma
enum TenantType { PERSONAL TEAM }
enum TenantRole { OWNER ADMIN MEMBER }      // personal 用户在其个人租户内视为 OWNER
enum TenantMemberStatus { ACTIVE INVITED SUSPENDED REMOVED }
enum SeatStatus { ASSIGNED VACANT }

model Tenant {
  id              String     @id @default(cuid())
  type            TenantType @default(PERSONAL)
  name            String                         // 团队名 / 个人昵称
  ownerUserId     String                         // 主账号（Book User.id）
  // 套餐快照（来源 MembershipPlan，开通/续费时写入）
  planId          String?
  packageLevel    String?                        // 标准/进阶/高级/豪华/至尊
  interval        MembershipInterval?            // MONTH | YEAR
  seatLimit       Int        @default(1)         // 已购席位上限
  maxConcurrency  Int        @default(2)         // 并发上限（轨道 D）
  currentPeriodEnd DateTime?
  // 共享积分池：CreditAccount(ownerType=TENANT, ownerId=tenant.id)
  status          String     @default("active")
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  members         TenantMember[]
  seats           Seat[]
  invites         TenantInvite[]

  @@index([ownerUserId])
}

model TenantMember {
  id           String             @id @default(cuid())
  tenantId     String
  tenant       Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId       String             // Book User.id
  role         TenantRole         @default(MEMBER)
  status       TenantMemberStatus @default(ACTIVE)
  seatId       String?            @unique          // 占用的席位
  // 成员级人均上限（可选，覆盖租户默认 perSeatCapCredits）
  monthlyCapCredits Int?
  joinedAt     DateTime           @default(now())

  @@unique([tenantId, userId])
  @@index([userId])
}

model Seat {
  id         String     @id @default(cuid())
  tenantId   String
  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  status     SeatStatus @default(VACANT)
  label      String?                              // "设计-01" 等
  createdAt  DateTime   @default(now())

  @@index([tenantId, status])
}

model TenantInvite {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  phone      String                               // 指定手机号邀请
  token      String   @unique                     // 邀请链接 token
  role       TenantRole @default(MEMBER)
  expiresAt  DateTime
  acceptedAt DateTime?
  createdBy  String
  createdAt  DateTime @default(now())

  @@index([tenantId])
}
```

### 1.2 现有表扩展

```prisma
// User（NextAuth）
model User {
  // ...
  primaryTenantId String?   // 当前默认上下文租户
  // 反查成员关系用 TenantMember（不在 User 上冗余 role）
}

// GatewayVendorCredential（轨道 A）
ownerScope  String   @default("USER")   // USER | TENANT
ownerId     String?                      // tenantId（团队级 Key）
channel     String?                      // 渠道名（direct / reseller-x）
sortOrder   Int      @default(0)
isDefaultForProvider Boolean @default(false)

// GatewayRequestLog（部分已加：seatId/canonicalModelKey/...）
tenantId             String?
actorBookUserId      String?
credentialAliasSnapshot String?
channelSnapshot      String?
```

> **复用既有**：`CreditAccount(ownerType=TENANT)`、`CreditLedger.actorUserId`、`ResourceMeterEvent(ownerType=TENANT)`、`TeamSeatTier`、`MembershipPlan` 已在统一积分计费中建好，本设计直接挂载，不重复造。

### 1.3 迁移策略

- 为**每个现有 Book 用户**自动建 1 个 `personal` 租户 + 1 条 `TenantMember(OWNER)`；`primaryTenantId` 指向它。行为与现网完全一致。
- 个人 → 团队「升级」：保留原 personal 租户，新建 team 租户；用户可在两个租户上下文间切换。

---

## 2. 账号关联与 SSO（如何「关联团队」）

**不新建登录体系**，扩展现有 Book SSO（详见总纲 §2.3）。

### 2.1 加入团队的三种方式

1. **邀请链接**：主账号生成 `TenantInvite` → 成员打开链接 → Book 登录/注册 → 接受 → 建 `TenantMember` + 分配空席位。
2. **手机号邀请**：指定手机号，发送短信（验证码 + 链接）；已注册同号登录后接受，未注册引导注册后入团。
3. **企业域**（后续）：同邮箱域自动可申请加入。

### 2.2 上下文切换（多租户归属）

一个 Book 账号可同时是：自己的 personal + 某 team 的 member。
- 顶部「当前空间」切换器：个人空间 / 团队空间。
- 切换即变更**计费来源**（个人积分账户 ↔ 团队共享池）与**资产可见域**。
- SSO token 载荷带 `tenant_id / role_type / package_level / seat_id`；子站（Canvas/Story/电商）据此决定扣费与资产域。

### 2.3 SSO 载荷扩展

| 字段 | 用途 |
|------|------|
| `tenant_id` | 资产域 + 计费账户定位 |
| `role_type` | 权限（能否管 Key/成员/删公共资产） |
| `seat_id` | 席位级人均统计与并发占用 |
| `package_level` / `package_expire` | 准入与过期 `active:false` |

---

## 3. 资源共享（重点：完整、可控）

### 3.1 资产模型（跨工具统一）

各工具产物（Canvas 项目、Story 项目、电商分镜、图片库/视频库/衣柜等）统一带：

```text
tenantId, ownerUserId, visibility (PRIVATE | TEAM_PUBLIC), assetType, ...
```

- **personal 租户**：全部 `PRIVATE`。
- **team 租户**：
  - **公共库 `TEAM_PUBLIC`**：团队所有成员可见可用；**仅 OWNER/ADMIN 可删/改归属**。
  - **成员私有 `PRIVATE`**：仅本人可见；成员离开团队时由 OWNER 决定「转公共 / 移交 / 删除」。

### 3.2 权限矩阵（资产）

| 操作 | OWNER | ADMIN | MEMBER |
|------|:---:|:---:|:---:|
| 查看公共库 | ✓ | ✓ | ✓ |
| 用公共库素材生成 | ✓ | ✓ | ✓ |
| 把自己产物「设为公共」 | ✓ | ✓ | ✓ |
| 编辑/删除公共库条目 | ✓ | ✓ | ✗ |
| 查看他人私有库 | ✗ | ✗ | ✗ |
| 删除成员私有库 | ✓（成员离队时）| ✗ | 本人 |
| 移交成员资产归属 | ✓ | ✓ | ✗ |

> **破坏性删除**（含 OSS 云端文件）一律二次确认（见规则 `destructive-delete-confirmation`）。删除公共素材第二次文案须写明「不可恢复，含云端存储（OSS）」。

### 3.3 共享积分池

- 团队积分发放到 `CreditAccount(ownerType=TENANT)`，**全员共享**。
- 每次生成在租户池扣费，流水记 `actorUserId` + `seatId`（谁花的）。
- **人均上限**：`Tenant.perSeatCapCredits` 默认；`TenantMember.monthlyCapCredits` 可单独覆盖。超额按 `SeatCapExceededError` 拦截（已实现于 `seat-billing-service.ts`）。
- UI 展示：池总额 / 已用 / 剩余 + 每成员本月消耗 Top 榜。

### 3.4 并发共享（轨道 D）

- `tenant:{id}:run_num` / `max_concurrency`（标准 2 / … / 至尊 35），Redis 原子校验。
- 席位不直接=并发；并发是租户级总闸，席位是计费与人均口径。

---

## 4. 财务对账与使用明细（重点：精细、完整、易懂）

财务遵循**单写原则**：账与策略只在 Book / Platform API（见联邦约束）。

### 4.1 三层账本视图

| 视图 | 可见者 | 数据源 | 用途 |
|------|--------|--------|------|
| **租户总账** | OWNER/ADMIN | 租户 `CreditLedger` + `ResourceMeterEvent` | 团队整体收支、套餐积分发放/消耗、BYOK 服务费+资源费 |
| **成员明细** | 各成员（自己）+ OWNER/ADMIN（全员） | `GatewayRequestLog` by `actorBookUserId/seatId` | 谁、何时、用哪个模型、几次、扣多少积分 |
| **平台对账** | 平台财务（ADMIN） | 厂商账单 ↔ `GatewayRequestLog` 成本快照 | 渠道差价、亏损行、绑错 Key 追溯 |

### 4.2 用户对账（团队/个人）

- **会员积分账单**（按月）：发放 GRANT、消耗 CONSUME、返还 REFUND、充值 TOPUP、期末净额，并**按模型**拆分。已实现 `buildUserCreditBill()`。
- **BYOK 账单**（按月）：技术服务费（按档/席位）+ 资源费（OSS·月 / 出网 GB / 任务数 × 系数）。已实现 `buildUserByokBill()` / `settleByokMonthly()`。
- 团队额外：**按成员/席位**二次下钻；导出 CSV。

### 4.3 厂商对账（平台）

- 阿里 `consumedetailbillv2` / KIE / 火山账单 → 按 `canonicalKey` 归口（`ModelAlias`）→ 与 `GatewayRequestLog` 成本快照聚合比对 → 差异表（OK/OVER/UNDER/缺失）。已实现 `reconcileVendorBill()`。
- 多 Key 就绪后，差异表再按 `channel` 维度拆分，核算各渠道实际折扣与算力差价。

### 4.4 使用明细颗粒度（每次生成一条）

`GatewayRequestLog` 每条含：时间、`actorBookUserId`、`seatId`、应用来源、`canonicalModelKey`、请求类型、秒数/张数、`creditsCharged`、`costSnapshotYuan`、`marginSnapshot`、`billingMode`、`credentialId/channel`、状态。
- 用量中心可按 **应用 / 模型 / 成员 / 凭证(渠道) / 时间** 下钻 + 导出。
- 失败/取消 `creditsCharged=0` 并触发 REFUND，账单可见返还。

### 4.5 易懂呈现原则

- 用户侧只显示**积分 / 套餐 / 次数**；成本、折扣、系数 M 仅平台财务可见（`resolveShowPricingInternals`）。
- 每张账单顶部给「一句话结论」（本月发放 X、消耗 Y、剩余 Z）+ 明细表 + 公式卡。

---

## 5. RBAC（轨道 B）

- 主账号（OWNER）可建/禁用成员，上限 = `Tenant.seatLimit`。
- 子账号（MEMBER）**硬禁止**：续费/充值、管 Key、改团队配置、删公共资产、看他人私有库。
- 所有写 API 经 `assertTenantPermission(ctx, action)` 统一校验。

| 能力 | OWNER | ADMIN | MEMBER |
|------|:---:|:---:|:---:|
| 续费/充值/改套餐 | ✓ | ✗ | ✗ |
| 增删成员/分配席位 | ✓ | ✓ | ✗ |
| 管理团队 Key（多凭证/默认） | ✓ | ✓ | ✗ |
| 设人均上限 | ✓ | ✓ | ✗ |
| 生成/用公共库 | ✓ | ✓ | ✓ |
| 看租户总账 | ✓ | ✓ | ✗ |
| 看本人明细 | ✓ | ✓ | ✓ |

---

## 6. 单点登录 vs 单会话（你的问题）

- **现状**：Book SSO 是「一次登录、全站互通」；NextAuth `strategy: "jwt"`（无状态），**同账号可多端同时在线**，无强制下线。
- **席位防共享（建议随团队体系一起做）**：
  - `User.sessionVersion`（或 `Tenant` 维度 `activeSeatSession`）。
  - 登录写新值并编入 JWT；`session` 回调比对，不一致即失效 → 旧端被挤下线。
  - 团队场景可做到「一个席位同时仅一个活动会话」，防止多人共用一席。

---

## 7. 多 Key（轨道 A）与团队的衔接

- 团队 Key 用 `ownerScope=TENANT, ownerId=tenantId`；个人 Key `ownerScope=USER`。
- 路由统一入口 `resolveGatewayCredential(apiKey, providerKind, modelKey, optionalCredentialId?)`：
  显式 credentialId → 该 provider 默认凭证 → sortOrder → 兼容第一条。
- 每条成功日志必含 `credentialId + channelSnapshot`，供渠道对账与差价核算。
- 绑定校验已就绪（`credit-billing-guard.ts`）：凭证厂商≠模型厂商或无成本档 → 阻断 + 审计。

---

## 8. 关键流程

### 8.1 开通团队
```
主账号 → /pricing 选团队档+席位数 → 下单 →
建 Tenant(team) + Seat×N + CreditAccount(TENANT) + GRANT 共享积分 →
主账号成为 OWNER 并占 1 席
```

### 8.2 成员生成扣费（共享池 + 人均上限）
```
成员在子站点击生成 → SSO 带 tenant_id/seat_id →
预估积分 → 校验人均上限 → 租户池扣 creditsCharged（流水记 actorUserId/seatId） →
成功 settle / 失败 release(REFUND)
```

### 8.3 月度结算
```
会员：周期末重置发放 monthlyGrantCredits（定时任务）
BYOK：settleByokMonthly(技术服务费×席位 + 资源费) → 出账单
```

---

## 9. UI 面（新增/改造）

| 位置 | 内容 |
|------|------|
| `/account/team`（新） | 团队概览：池余额、席位占用、成员列表、邀请、人均上限 |
| `/account/team/members`（新） | 成员/席位管理、角色、移交、移除 |
| `/account/team/billing`（新） | 租户总账 + BYOK 账单 + 导出 |
| `/account/usage`（已建） | 个人明细；团队上下文下增加「成员/席位」维度 |
| 顶部「当前空间」切换器 | 个人 ↔ 团队上下文 |
| `/admin/finance/reconciliation`（已建） | 增 channel 维度差异 |

---

## 10. 落地路线（映射总纲轨道）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **Sprint 0** | Tenant/TenantMember/Seat/Invite + User 扩展 + 迁移 personal + TenantContext + SSO 载荷 | — |
| **轨道 A** | 多 Key 渠道/默认/路由/按凭证对账 | Sprint 0 |
| **轨道 B** | RBAC + 成员/席位管理 UI + 邀请 | Sprint 0 |
| **积分接入** | 各子站生成链路接 `consumeTeamCredits/consumeCredits` + 人均上限 | Sprint 0 + 已建积分体系 |
| **轨道 E** | 资产双库（公共/私有）+ 跨工具 visibility | Sprint 0 |
| **轨道 D** | Redis 租户并发 | 托管 Redis |
| **结算** | 月度重置定时任务 + 团队账单页 + 厂商 channel 对账 | 上述 |
| **单会话** | sessionVersion 挤下线 | Sprint 0 |

> 已完成的**统一积分计费**（账户/席位/对账/防护/后台/报价页/用量中心）是本设计的财务地基；团队体系做完即可端到端跑通「按席位售卖 + 共享池 + 精细对账」。

---

## 11. 验收标准（团队 MVP）

- [ ] 主账号开通团队、按席位计费、生成共享积分池
- [ ] 邀请/接受、席位分配、角色权限生效（子账号禁管 Key/续费/删公共资产）
- [ ] 公共库/私有库可见域正确；公共删除二次确认（含 OSS 文案）
- [ ] 共享池扣费 + 人均上限拦截；失败返还
- [ ] 租户总账 + 成员明细 + BYOK 账单可看可导出
- [ ] 厂商账单按 canonicalKey（+channel）对账出差异
- [ ] （可选）一席一活动会话，挤下线生效
```
