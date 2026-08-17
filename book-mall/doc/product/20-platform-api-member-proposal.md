# API 会员 — 方案草案（待评审 · 未实施）

> **状态**：讨论稿。本文描述「订阅会员在平台申请 Key、HTTP 直接调用平台模型」的产品与技术方案；**不含代码实现**。
>
> **命名约定（2026-08）**
>
> | 用户叫法 | 系统 `billingPersona` | 说明 |
> |---------|----------------------|------|
> | **订阅会员** | `PLATFORM_CREDIT` | App 内使用，平台代付 AI，按积分扣费 |
> | **自带 key 会员** | `BYOK` | 自备厂商 Key，经 Gateway 绑定，厂商账单自理 |
> | **API 会员** | （待定，见 §2） | 在 Book 申请平台 API Key，HTTP 调平台已上架模型 |

---

## 1. 背景与目标

### 1.1 现状

- **订阅会员**：系统在后台创建隐藏 `sk-gw`（`managedByPlatform: true`），用户无感；Canvas / Story / 工具站经 Book 内部转发 Gateway，扣积分。
- **自带 key 会员**：用户在 Gateway 绑厂商凭证、自建 `sk-gw`，回 Book 关联；推理走用户 Key，平台不代付 AI。
- **底层能力**：Book 已暴露 `/api/gw/v1/*`，支持 `Authorization: Bearer sk-gw-...`；平台凭证池、积分预检与结算链路已存在。

### 1.2 缺口

订阅会员 **无法** 拿到可用于外部 HTTP 调用的明文 API Key；Gateway 控制台对订阅会员也非主路径。产品侧缺少「平台模型开放 API」的独立身份与申请流程。

### 1.3 目标

让 **订阅会员**（及满足准入的团队）在 Book **自助申请平台 API Key**，用统一 HTTP 接口调用 **与 App 内相同的已上架模型**，**计费与 App 内一致**（扣平台积分，非厂商直结）。

### 1.4 非目标（首版）

- 不替代自带 key 会员（用户自备厂商 Key 的场景保留）。
- 不默认开放「注册表全量模型」；首版建议与 **已上架 offering + 已发布积分价** 对齐。
- 不做「卖 Token / 代扣云厂商账单」；仍走 Gateway + 平台凭证池。

---

## 2. 产品定义

### 2.1 三种会员对比

| 维度 | 订阅会员（App） | 自带 key 会员 | **API 会员（本方案）** |
|------|----------------|--------------|------------------------|
| 使用场景 | Canvas / Story / 工具站 UI | 同上 + 外部脚本（用户 Key） | **外部 HTTP / 自建服务** |
| 厂商 Key | 平台池（隐藏） | 用户自备 | **平台池** |
| 用户可见 Key | 否 | 是（Gateway 自建 sk-gw） | **是（Book 发放 sk-gw）** |
| AI 费用 | 平台积分 | 用户 ↔ 厂商 | **平台积分** |
| 会员订阅 | 需要 | 需要（工具准入） | **需要** |
| Gateway 控制台 | 通常不需要 | 必须（绑凭证） | **可选（只看日志）** |

### 2.2 身份模型（待选）

**方案 A — 订阅会员子能力（推荐）**

- 不新增 `billingPersona` 枚举。
- `PLATFORM_CREDIT` 用户开通会员后，可在「API 会员」页 **额外创建/轮换** 一把 **对外 API Key**。
- 与现有「隐藏托管 Key」（供 App 内 BFF 使用）**分离**：  
  - `managedByPlatform + apiAccessVisible: false` → App 内专用  
  - `managedByPlatform + apiAccessVisible: true` → 用户可见、可吊销的 API Key  

**方案 B — 注册时第三种 persona**

- 新增 `BillingPersona.API_PLATFORM` 或类似枚举。
- 注册、报价、财务全链路分叉，改动面大；**不推荐首版**。

**方案 C — 与 BYOK 共用 sk-gw 入口**

- 订阅用户去 Gateway 自建 Key 并绑平台池凭证（运维代绑）。
- 体验差、易与自带 key 会员混淆；**不推荐**。

**建议**：采用 **方案 A**。

---

## 3. 用户流程（目标态）

```text
注册 / 登录（订阅会员 PLATFORM_CREDIT）
  → 开通会员订阅（与 App 共用套餐体系）
  → 个人中心 → API 会员 → 创建平台 API Key（明文仅展示一次）
  → 外部服务：Authorization: Bearer sk-gw-...
     POST https://{book-origin}/api/gw/v1/chat/completions
     POST https://{book-origin}/api/gw/v1/jobs/createTask
     …
  → 按模型扣积分；余额不足 → 403/402
  → 用量：Book 财务中心 + Gateway 请求日志（clientSource=EXTERNAL）
```

### 3.1 准入

- 有效会员订阅（个人 / 团队），与 App 工具准入一致。
- 积分池有余额（或视频池，按模型类型）；生成前 `assertCreditsBeforeGenerate`。
- 可选：仅 **指定套餐 tier** 以上开放 API（产品策略）。

### 3.2 Key 生命周期

| 操作 | 说明 |
|------|------|
| 创建 | 生成 `sk-gw`，绑平台凭证池，展示明文一次 |
| 查看 | 仅前缀 `sk-gw-xxxx****` |
| 轮换 | 吊销旧 Key，创建新 Key（需二次确认） |
| 吊销 | 立即失效；App 内隐藏 Key 不受影响 |

---

## 4. 技术方案

### 4.1 已有可复用

| 模块 | 路径 / 行为 |
|------|-------------|
| HTTP 入口 | `book-mall/app/api/gw/v1/**` |
| 鉴权 | `requireGatewayV1Auth` ← Bearer `sk-gw` |
| 平台凭证池 | `resolvePlatformVendorCredentialIds` + `ensurePlatformManagedKeyBindingsSynced` |
| 积分预检 / 结算 | `assertCreditsBeforeGenerate` / `gateway-credit-settlement`（`billingMode=PLATFORM_CREDIT`） |
| 模型路由 | `routeGatewayModel` + `pickCredentialForKind` |
| 日志 | `GatewayRequestLog`，`clientSource=EXTERNAL` |

### 4.2 待开发（按优先级）

#### P0 — 最小可用

1. **数据模型**（Prisma）  
   - `GatewayApiKey` 增加字段，例如：`apiAccessPurpose: HIDDEN_APP | USER_API | null`  
   - 或 `visibleToUser: boolean` + `revokedAt` 现有字段  

2. **Book API**  
   - `GET/POST/DELETE /api/account/platform-api-key`  
   - 创建时：`createPlatformManagedApiKey` 变体，返回 `{ rawKey, prefix, createdAt }` 一次  

3. **Book UI**  
   - `/account/api-member` 或并入个人中心「API 会员」卡片  
   - 创建 / 前缀展示 / 轮换 / 吊销 / 链接开发者文档  

4. **模型白名单**  
   - 在 `/api/gw/v1/*` 创建日志前，对 `billingPersona=PLATFORM_CREDIT` + `clientSource=EXTERNAL` 校验模型属于 **ACTIVE offering**（与报价页一致）  

5. **文档**  
   - Base URL、鉴权头、主要 endpoint、错误码、积分不足示例  

#### P1 — 安全与运营

- 每用户 Key 数量上限（如 2 把）  
- 可选 IP  allowlist（Key 级 metadata）  
- 限流（按 Key / 用户 / 模型）  
- 团队：Tenant 级 API Key，扣团队共享池  

#### P2 — 开发者体验

- OpenAPI / Postman 集合  
- 与 `examples/platform-client` 并列的 **curl / Python 示例**  
- finance-web 单独「API 调用量」视图  

### 4.3 与现有隐藏 Key 的关系

```
User (PLATFORM_CREDIT)
  ├── gatewayApiKeyId → hidden sk-gw (App BFF / Canvas 内部 Gateway-Internal)
  └── platformApiKeys[] → 0..N 用户可见 sk-gw (EXTERNAL HTTP)
```

- **不要**把隐藏 Key 明文暴露给用户。  
- App 内 BFF 继续用 `Gateway-Internal` 或现有 `User.gatewayApiKeyId` 逻辑；用户 API Key 仅用于外部 Bearer 调用。  
- 若坚持 `User.gatewayApiKeyId` 单字段，需评估：外部 Key 轮换是否影响 App——**建议双轨**。

### 4.4 计费

- 与 App 内生成 **完全相同**：`billingMode = PLATFORM_CREDIT`，按 `ModelCreditPrice` / 成本快照扣积分。  
- **不**走 BYOK 超额逻辑。  
- 视频模型：沿用 RESERVE → settle 流程。

### 4.5 模型范围（待产品确认）

| 选项 | 优点 | 风险 |
|------|------|------|
| **仅已上架 offering**（推荐） | 与报价页、成本可控一致 | 新模型需先上架 |
| 注册表全量 + 平台池凭证 | 接入快 | 未定价模型可能亏损 |
| 按套餐 tier 分模型包 | 可差异化定价 | 规则复杂 |

---

## 5. 风险与对策

| 风险 | 对策 |
|------|------|
| 平台 API Key 泄露 → 积分被刷 | 轮换/吊销、限流、异常告警、可选 IP 限制 |
| 与自带 key 会员混淆 | UI 分区命名；BYOK 仍走 Gateway 自建 Key |
| 隐藏 Key 与用户 Key 混用 | 数据模型区分 `apiAccessPurpose` |
| 未上架模型被裸调 | EXTERNAL 路径加强 offering 校验 |
| 团队席位 / 扣费归属 | 外部 Key 绑 Tenant 或 User，文档写清 |

---

## 6. 实施阶段建议

| 阶段 | 交付 | 预估 |
|------|------|------|
| **Phase 0** | 本文评审定稿：身份模型、模型范围、UI 入口 | — |
| **Phase 1** | P0：单用户 API Key CRUD + 白名单 + 一页开发者文档 | 小 |
| **Phase 2** | P1：限流 + 团队 Key + 财务视图 | 中 |
| **Phase 3** | P2：OpenAPI、示例 SDK、监控大盘 | 中 |

---

## 7. 待讨论问题（请产品确认）

1. **API 会员是否必须单独买套餐**，还是「任意订阅会员即可申请 Key」？  
2. **模型范围**：仅 offering 上架 vs 全注册表？  
3. **是否允许 BYOK 用户同时申请平台 API Key**？（建议：否，身份互斥）  
4. **Key 数量上限**与是否支持 **只读/只写 scope**（如仅 LLM、禁 VIDEO）？  
5. **对外 Base URL**：生产用 `book` 主域还是独立 `api.` 子域？  
6. **首版是否开放异步任务**（`createTask` + `recordInfo` 轮询）全量？

---

## 8. 参考

- [gateway-user-guide.md](./gateway-user-guide.md)  
- [platform-api-v1.md](../tech/platform-api-v1.md)  
- [12-platform-app-federation.md](./12-platform-app-federation.md)  
- 实现参考：`lib/gateway/platform-managed-key.ts`、`app/api/gw/v1/**`
