# 新模型接入强制规范（平台代付 · Gateway · 运营中心 · 积分）

> **状态**：强制（2026-08）  
> **适用范围**：凡在平台代付（`PLATFORM_CREDIT`）或 API 会员（`API_PLATFORM`）场景下 **新接入、新上架、新暴露给用户选模** 的 AI 模型。  
> **性质**：与 [finance-rule-v1.0](../finance/finance-rule-v1.0.md)、[21-unified-credit-formula-v2](./21-unified-credit-formula-v2.md) 同级；**未完成本清单不得合并上线**。  
> **Agent / Code Review**：`.cursor/rules/new-model-onboarding-mandatory.mdc`

---

## 1. 总则

### 1.1 必须经 Gateway，禁止直连厂商

| 要求 | 说明 |
|------|------|
| **唯一调用路径** | 业务代码 → `*-gateway-client` → `POST /api/gw/v1/*` → `createRequestLog` → `assertModelRegistered` → 厂商代理 → `finalizeRequestLog` |
| **禁止** | 在子应用、`book-mall` 业务层、`.env.local` 写入厂商 API Key 并 `fetch` 厂商域名绕过 Gateway |
| **禁止** | `model-router` 无法路由时加「直连 fallback」；须先完成 Gateway 注册与凭证绑定 |
| **凭证** | 平台代付：Gateway 模型管理页（`:3005/dashboard/models`）为 canonical 账号绑定 `GatewayVendorCredential`（`platform-pool`）；用户 BYOK 走个人 `sk-gw` 绑定 |

详见：`.cursor/rules/gateway-platform-vendor-credentials.mdc`、`.cursor/rules/canvas-gateway-no-direct-connect.mdc`。

### 1.2 必须完成运营中心配置

凡 **平台代付** 新接入模型，除 Gateway 技术注册外，**必须**在 Finance「模型运营中心」完成展示与分发配置，使用户在各应用选模列表中可见、来源标签正确、按应用/场景上架。

分层见 [model-operations-center.md](./model-operations-center.md)：

| 层 | 必做项 | 入口 |
|----|--------|------|
| L1 技术注册 | `canonicalKey` + `GatewayModelRoute` + `gatewayPublished` | `canonical-registry.ts` + `gateway:seed-registry` |
| L2 凭证绑定 | 平台池或 BYOK 厂商 Key | Gateway `:3005/dashboard/models` |
| L3 商业上架 | `AppModelOffering` ACTIVE + 已发布积分价 | Finance「商业上架」 |
| L4 展示配置 | `sourceLabel`（第三方 / 平台 / 品牌名） | Finance「展示配置」或 seed presentation |
| L5 应用分发 | `AppModelShelf`（`appTag` + `sceneKey`） | Finance「应用分发」或 `model-ops-seed-config.ts` + `gateway:seed-model-ops` |

**无例外**：每一个新模型接入 PR 须包含 L1–L5 中与本模型相关的项；仅内部灰度可临时 `DEPRECATED`/`INACTIVE`，不得长期「只注册不上架」或「只写前端白名单」。

### 1.3 接入前必须核算成本并配置积分

| 要求 | 说明 |
|------|------|
| **成本真源** | `ModelCostProfile`：厂商挂牌价、折扣率、计费单位（张 / 秒 / 千 Token / 次） |
| **积分换算** | 按 [21-unified-credit-formula-v2](./21-unified-credit-formula-v2.md)：`U₀ = round(P ÷ anchor)`，`扣减 = U₀ × units`；须过 `videoMinMarginGuard`（默认毛利护栏 22%） |
| **发布** | `ModelCreditPrice` 发布快照；Finance「单积分计价」面板可验算 |
| **用户可见** | 生成前展示 **预估扣分**；生成后流水/任务记录展示 **实际扣分**（与 App、API 会员同 `U₀`） |

**禁止**：未录入成本、未发布积分价即对用户开放选模或扣费。

---

## 2. 接入前：成本与定价（必须先做）

### 2.1 成本采集

1. 确认厂商 **官方计费文档** URL、计费维度（秒 / 张 / 千 Token / 次）、档位（分辨率、有声/无声等）。
2. 在财务后台录入或更新 `ModelCostProfile`：
   - `listCost`（挂牌单价）
   - `discountRate`（渠道/合约折扣，无则 0）
   - `billingKind` 与 `unitLabel`（与 [gateway-billing-units.mdc](../../../.cursor/rules/gateway-billing-units.mdc) 一致）
3. 对视频类模型：明确 **计费秒数** 来源（用户选择时长、成片时长、封顶 15s 等），写入 runner 与 `log-billing-metrics` 约定。

### 2.2 积分验算（接入评审门槛）

在合并代码前，提交 **成本—积分测算表**（可贴在 PR 或 `doc/plans/`）：

| 字段 | 示例 |
|------|------|
| canonicalKey / modelKey | `doubao-seedance-2.0` |
| 计费单位 | 秒 |
| 净成本 C | ¥1.0/秒 |
| M（毛利系数） | 1.4 |
| U₀ | 35 积分/秒 |
| 典型用量扣分 | 15s → 525 积分 |
| 锚定毛利 | ≥ 22% |

验算工具：`lib/pricing/unified-credit-formula.ts`、Finance `/admin/credit-pricing`。

### 2.3 缺失成本处理

- 厂商未公布或档位不明：**不得**对用户开放；可仅完成 L1 注册并标记 `gatewayPublished=false`。
- 紧急上线：须产品 + 财务书面确认临时价，并在 `missing-model-cost-seeds.ts` / 价库补录后 **7 日内** 对齐正式成本。

---

## 3. 必做清单（每个新模型一条，逐项勾选）

复制到 PR 描述或 `doc/plans/YYYY-MM-DD-<model>.md`：

```markdown
### 新模型接入：<displayName>（`<canonicalKey>`）

- [ ] **L1 Gateway 注册**
  - [ ] `canonical-registry.ts` 登记 canonical + `appTags`
  - [ ] `GatewayModelRoute`（vendor / providerKind / modelKey / requestKind / role）
  - [ ] `model-router.ts` 可路由；`assertModelRegistered` 通过
  - [ ] `pnpm gateway:seed-registry -- --confirm`
  - [ ] `pnpm gateway:audit-gaps` 无新增缺口

- [ ] **L2 凭证绑定**
  - [ ] Gateway 模型管理页为平台代付 canonical 账号绑定厂商凭证
  - [ ] 冒烟：平台池 `pickCredentialForKind` 可取到 Key

- [ ] **L3 商业上架 + 积分价**
  - [ ] `ModelCostProfile` 已录入
  - [ ] `AppModelOffering` ACTIVE，`ModelCreditPrice` 已发布
  - [ ] Finance 单积分面板验算通过毛利护栏

- [ ] **L4 展示配置**
  - [ ] `sourceLabel` 已设置（KIE 默认「第三方」，火山默认「平台」，品牌模型填品牌名）
  - [ ] `displayName` / `description` 与用户可见文案一致

- [ ] **L5 运营中心分发**
  - [ ] `AppModelShelf`：目标 `appTag` + `sceneKey` 已 ACTIVE
  - [ ] 或已更新 `model-ops-seed-config.ts` 并执行 `pnpm gateway:seed-model-ops`
  - [ ] `GET .../gateway/models/registry?app=&sceneKey=` 返回该模型

- [ ] **L6 业务接入**
  - [ ] 子应用选模走 Gateway registry / `listModelsForApp`（**禁止**前端硬编码新模型卡片列表）
  - [ ] Runner / createTask body 字段与厂商 API 对齐
  - [ ] `clientPage` / `clientSource` 符合各应用约定

- [ ] **L7 积分展示**
  - [ ] 生成前：预估扣分（如 `previewModelCredits` / credits-preview API）
  - [ ] 生成后：任务记录 / 用量中心展示实际扣分
  - [ ] 余额不足：明确提示，不单改友好文案掩盖根因

- [ ] **L8 平台 API 文档（供 API 会员对接）**
  - [ ] 已更新本文 §4 或对应 `doc/tech/*` 能力表
  - [ ] 写明：鉴权、`modelKey`、请求路径、异步轮询、计费单位

- [ ] **L9 测试**
  - [ ] 单元测试：body 构建 / 路由 / 积分公式
  - [ ] 端到端：选模 → 生成 → GatewayRequestLog.model 正确 → 扣分正确
```

---

## 4. 平台 API 调用方式（API 会员与第三方对接）

> API 会员与 App 用户 **共用同一套 `modelKey` 与 `U₀`**；差异仅在充值 `ppc`，扣分相同。  
> 产品方案：[20-platform-api-member-proposal.md](./20-platform-api-member-proposal.md)

### 4.1 鉴权

| 身份 | 鉴权方式 |
|------|----------|
| App 子应用（Canvas / QR / Tool 等） | Book SSO → `access_token` → BFF → Gateway；或用户关联 `sk-gw` |
| API 会员 | 平台 API Key + `sk-gw`（或平台代发的 Gateway Key） |
| Gateway 直连 | `Authorization: Bearer sk-gw-...` |

未关联 Gateway Key → `403 GATEWAY_KEY_REQUIRED`（见 [gateway-user-guide.md](./gateway-user-guide.md)）。

### 4.2 统一调用面（按能力选型）

| 能力 | Gateway 路径 | 说明 |
|------|--------------|------|
| 异步任务（图/视频/部分音频） | `POST /api/gw/v1/jobs/createTask` | Body 含 `providerKind`、`modelKey`、厂商参数；返回 `taskId` |
| 任务查询 | `GET /api/gw/v1/jobs/recordInfo` 或厂商专用 poll 路由 | 以各 `*-jobs.ts` 为准 |
| 流式 Chat / LLM | `POST /api/gw/v1/chat/completions` 或 SSO 代理 `POST /api/sso/tools/gateway/chat` | 流式 SSE |
| DashScope 族 | `POST /api/sso/tools/gateway/dashscope` | 试衣 / 百炼部分能力 |

**约束**：

- 请求中的 `modelKey` **必须**已在 `GatewayModelRoute` 登记；否则 Gateway 400。
- 每次成功调用写入 `GatewayRequestLog`，作为计费与对账真源。
- 子应用 **不得** 要求 API 对接方直连厂商域名。

### 4.3 新模型文档模板（每个模型在 PR 中补充）

在 `doc/tech/` 或模型专题页（如 [model-api.md](../model-api.md)）增加一节：

```markdown
## <displayName>（`<modelKey>`）

| 项 | 值 |
|----|-----|
| canonicalKey | `...` |
| providerKind | KIE / VOLCENGINE / BAILIAN / … |
| Gateway 入口 | `POST /api/gw/v1/jobs/createTask` |
| 计费单位 | 秒 / 张 / 千 Token |
| U₀（已发布） | N 积分/单位 |
| 异步 | 是/否；轮询路径 |
| 官方文档 | https://... |

### 请求示例（经 Gateway）

Authorization: Bearer sk-gw-...
Content-Type: application/json

{ "providerKind": "...", "modelKey": "...", ... }

### 计费说明

- 扣减 = U₀ × units（units 定义：…）
- 与 App 内生成扣分一致
```

### 4.4 积分查询（App / 集成方）

| 场景 | API |
|------|-----|
| 快速复制生成前预览 | `POST /api/platform/v1/quick-replica/credits-preview` |
| 通用模型预估 | `previewModelCredits`（book-mall 内部）；各应用 BFF 暴露等价接口 |
| 用量与明细 | 个人中心「积分用量中心」；API 会员账单页 |

详见 [22-quick-replica-credits-preview.md](./22-quick-replica-credits-preview.md)。

---

## 5. 运营中心自动上架约定

### 5.1 代码侧（推荐与 PR 同提交）

1. 在 `lib/platform-model/canonical-registry.ts` 登记 canonical 与 `appTags`。
2. 在 `lib/platform-model/model-ops-seed-config.ts` 为目标 `sceneKey` 追加 `modelKey`（Canvas / QuickReplica 等场景白名单）。
3. 执行：

```bash
cd book-mall
pnpm gateway:seed-registry -- --confirm   # L1
pnpm gateway:seed-model-ops              # 预览 L5
pnpm gateway:seed-model-ops -- --confirm # 落库 L5
```

### 5.2 运营侧（Finance 后台）

路径：finance-web → **模型运营中心**

| Tab | 操作 |
|-----|------|
| 商业上架 | 确认 offering ACTIVE、价格已发布 |
| 展示配置 | 编辑 `sourceLabel`、描述 |
| 应用分发 | 按 `appTag` + `sceneKey` 上架/排序 |

**Shelf 规则**：某 `appTag+sceneKey` 一旦存在 shelf 记录，则 **仅 ACTIVE 行可见**；新增场景须配全白名单，避免漏模。

---

## 6. 验收标准（上线闸门）

1. **Gateway**：`assertModelRegistered(modelKey)` 通过；`GatewayRequestLog` 含正确 `model`、`clientPage`。
2. **运营中心**：registry API 在目标 `app` + `sceneKey` 返回该模型；`sourceLabel` 符合产品规则。
3. **定价**：`ModelCreditPrice` 已发布；财务面板毛利 ≥ 护栏。
4. **用户体验**：选模列表可见；生成前见预估积分；生成后见实际扣分。
5. **API 文档**：§4.3 模板已填；API 会员可用同一 `modelKey` 调用。
6. **审计**：`pnpm gateway:audit-gaps` 无未登记缺口；无业务代码直连厂商。

---

## 7. 禁止事项（Review 一票否决）

| 禁止 | 正确做法 |
|------|----------|
| 前端 / 子应用硬编码模型列表 | `listModelsForApp` / registry API + `AppModelShelf` |
| `.env` 增加 `VENDOR_*_API_KEY` 给单模型用 | Gateway 凭证池 |
| 未定价即 `gatewayPublished=true` 且上架 | 先 L3 再 L5 |
| 仅改 `friendly-task-error` 掩盖失败 | 按 debug-before-friendly-errors 修根因 |
| 子应用复制计费公式 | Single Writer：book-mall `unified-credit-formula` |

---

## 8. 相关文档

| 文档 | 用途 |
|------|------|
| [gateway-unified-model-registry.md](../tech/gateway-unified-model-registry.md) | L1 注册表 ADR |
| [model-operations-center.md](./model-operations-center.md) | L4/L5 运营中心 |
| [21-unified-credit-formula-v2.md](./21-unified-credit-formula-v2.md) | 积分公式 |
| [gateway-user-guide.md](./gateway-user-guide.md) | 用户 / sk-gw 流程 |
| [platform-api-v1.md](../tech/platform-api-v1.md) | SSO 与 BFF |
| [story-gateway-models.md](./story-gateway-models.md) | Canvas/Story 模型与凭证分池 |

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-19 | 首版：强制 Gateway + 运营中心 + 成本积分 + API 文档 + 用户扣分可见 |
