# Gateway 统一模型注册表（ADR）

> 状态：已实施（2026-06）  
> 关联：`gateway-volcengine-architecture.md`、`12-platform-app-federation.md`

## 1. 背景

此前存在三套平行 modelKey 清单（Gateway 控制台硬编码、ecom 分镜常量、`scenario-registry` 的 platform/ecom 块），且「候选厂商」误将不同 canonical 模型（如 DeepSeek / Qwen / Gemini）放在同一槽位竞价。

目标：**Gateway 为唯一模型目录**；各应用仅按 `appTags` + 能力过滤；财务后台按 canonical 管理多厂商路由。

## 2. 核心概念

| 概念 | 说明 |
|------|------|
| **canonicalModelKey** | 逻辑模型唯一 ID（`ModelCatalog.canonicalKey`） |
| **GatewayModelRoute** | 同一 canonical 下的一条厂商路由：`vendor` + `modelKey` + `providerKind` |
| **AppModelOffering** | 平台代付「上架」行，**一行一 canonical**；含当前 active 路由与积分价 |
| **AppModelCandidate** | 同 offering 下多条路由候选；**canonicalModelKey 必须相同** |
| **appTags** | 模型适用应用：`canvas` / `story` / `tool` / `ecom` / `prompt-optimizer` |
| **PlatformMediaDefault** | 四媒介槽默认 canonical（无用户选模时的 fallback） |

## 3. 行为规则

### 3.1 财务自动路由

- 候选来源：`GatewayModelRoute WHERE canonicalModelKey = offering.canonicalModelKey`
- `pickBestCandidate`：毛利达标（`marginPassesGuard`）前提下 **netCostYuan 最小**
- `routeLocked = true` 时跳过自动重算；运营可手动「设为当前」

### 3.2 平台代付选模

- 条件：`gatewayPublished && appTags ∋ app && offering.status = ACTIVE`
- 展示：按 **canonicalKey 去重**；每个 canonical 一条（使用 activeModelKey）

### 3.3 BYOK 选模

- 条件：`gatewayPublished && route.providerKind ∈ user.boundKinds`
- **不**应用 offering 默认路由；用户自选 modelKey
- 按 canonical 去重展示

### 3.4 Gateway 调用

- `assertModelRegistered(modelKey)`：modelKey 须存在于 active `GatewayModelRoute`
- 未注册 → 400

## 4. 数据模型

见 `prisma/schema.prisma`：`GatewayModelRoute`、`ModelCatalog` 扩展、`AppModelOffering.canonicalModelKey @unique`。

## 5. API

| 路径 | 用途 |
|------|------|
| `GET /api/gateway/models` | 用户 Gateway 控制台目录（DB + boundKinds） |
| `GET /api/sso/tools/gateway/models/registry?app=&role=` | 应用选模（平台代付 / BYOK） |

实现：`lib/gateway/model-registry.ts`

## 6. 迁移

- 删除 `ECOMMERCE_SCENARIO_REGISTRY`；canonical 清单见 `lib/platform-model/canonical-registry.ts`
- Seed：`scripts/seed-gateway-model-registry.ts`
- 废弃 `AppModelOffering WHERE appKey='ecom'`
