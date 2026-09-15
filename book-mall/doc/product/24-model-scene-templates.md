# 模型场景模板（Scene Templates）

> **状态**：强制（2026-09）  
> **性质**：与 [23-new-model-onboarding-mandatory](./23-new-model-onboarding-mandatory.md)、[gateway-unified-model-registry](../tech/gateway-unified-model-registry.md) 同级。  
> **勿与** [模板管理后台](./模板管理后台.md)（QR/电商**内容** catalog）混淆——本文只管 **选模场景规则**。

---

## 1. 总则

### 1.1 两层分离（硬规则）

| 层 | 职责 | 存什么 | 不存什么 |
|----|------|--------|----------|
| **场景模板** | 规则限定：这类生成长什么样、能填什么、怎么估平台分 | `SceneTemplate` + `SceneTemplateModel`（仅 `canonicalModelKey`） | vendor、Fintech、credential、`modelKey` 真源 |
| **厂商路由** | 这次实际打哪家 API、用哪档成本 | `GatewayModelRoute` + `AppModelOffering` + `ModelCostProfile` | 不写进模板规则 |

**换厂商 / 换渠道价：只动路由与成本层，模板定义不变。**  
发布静态目录时，可把当前 `activeModelKey` / `creditsPerUnit` 写入 **解析快照**（非规则真源）。

### 1.2 六类模板 ID

| id | 标题 | 典型用途 |
|----|------|----------|
| `text` | 文本模型 | LLM / 大纲 / 分镜脚本 |
| `t2i` | 文生图 | 纯文生图 |
| `i2i` | 图生图 | 编辑 / 参考图生图 |
| `t2v` | 文生视频 | 无参考或弱参考视频 |
| `i2v` | 图生视频 | 图生视频 / 首尾帧 / 多参 |
| `v2v` | 视频生视频 | 视频改写 / 动作迁移等 |

同一 `canonicalModelKey` **允许**挂多个模板（如 Seedance 同时挂 `t2v` + `i2v`）。

### 1.3 Gateway 与上线门禁

1. 所有可调用模型必须经 Gateway 注册与凭证绑定，**禁止应用直连厂商**。  
2. 绑定到模板、进入静态目录前，必须：有效 `GatewayModelRoute` + `ModelCostProfile` + 已发布 `ModelCreditPrice`（过毛利护栏）+ `AppModelOffering` ACTIVE（或绑定瞬间可自动校验等价条件）。  
3. 用户余额、冻结、实扣 **始终动态**；静态包只含平台积分单价。

---

## 2. 数据模型

### 2.1 `SceneTemplate`

| 字段 | 说明 |
|------|------|
| `id` | 固定六类之一，如 `i2v` |
| `title` | 展示名 |
| `status` | `ACTIVE` \| `DEPRECATED` |
| `sortOrder` | 排序 |
| `rulesJson` | 纯规则：时长范围、参考图上限、`paramSchema` 等（**无 vendor**） |

### 2.2 `SceneTemplateModel`

| 字段 | 说明 |
|------|------|
| `templateId` | FK → SceneTemplate |
| `canonicalModelKey` | 逻辑模型（**仅此**，不绑厂商） |
| `status` | ACTIVE / HIDDEN / DEPRECATED |
| `sortOrder` | 模板内排序 |
| `rulesOverrideJson` | 可选，覆盖模板级规则（仍无 vendor） |

### 2.3 `ModelTemplateCatalogSnapshot`

| 字段 | 说明 |
|------|------|
| `version` | 如 `20260914.1` |
| `publishedAt` / `publishedBy` | 审计 |
| `payloadJson` | 完整静态目录 |

---

## 3. 静态目录 schema（发布产物）

```json
{
  "version": "20260914.1",
  "publishedAt": "2026-09-14T13:00:00.000Z",
  "templates": [
    {
      "id": "i2v",
      "title": "图生视频",
      "status": "ACTIVE",
      "rules": { "durationMin": 4, "durationMax": 15, "maxRefImages": 9 },
      "models": [
        {
          "canonicalModelKey": "seedance-2.0",
          "displayName": "Seedance 2.0",
          "unit": "PER_SEC",
          "creditsPerUnit": 50,
          "tiers": [{ "tierRaw": "720P", "creditsPerUnit": 50 }],
          "rules": { "durationMin": 4, "durationMax": 15 },
          "resolved": {
            "modelKey": "doubao-seedance-2.0",
            "vendor": "volcengine",
            "providerKind": "VOLCENGINE"
          }
        }
      ]
    }
  ]
}
```

- `rules`：来自模板（+ override）  
- `creditsPerUnit` / `unit`：来自 `ModelCreditPrice`  
- `resolved.*`：来自 `AppModelOffering` 当前路由（**快照**；换路由后须重新发布）

### 估分

```
预估积分 ≈ creditsPerUnit × units
units = 秒数 | 张数 | 千 token（前端按 unit 计算）
```

用户实收人民币、余额、冻结 → 动态 API（不进静态包）。

### 刷新策略

CDN / API 版本包 + 客户端缓存；启动或定时对 `version`。改价/换路由/停模板 → 运营点「发布」出新 version。

---

## 4. 管理入口与 API

| 入口 | 说明 |
|------|------|
| Finance「平台模型」→ Tab **场景模板** | 启停模板、绑定 canonical、发布目录 |
| `GET/POST /api/finance/admin/scene-templates` | 管理 CRUD |
| `POST /api/finance/admin/scene-templates/publish` | 写 Snapshot |
| `GET /api/sso/tools/gateway/model-templates/catalog` | 子应用读最新（或 `?version=`） |

---

## 5. 与运营中心其它层关系

| 层 | 关系 |
|----|------|
| L1–L2 Gateway + 凭证 | 前置；无路由不得绑定 |
| L3 Offering + 积分价 | 绑定门禁；发布时取 resolved + U₀ |
| L4 sourceLabel | 展示仍走 catalog；模板不管来源文案 |
| L5 AppModelShelf | **应用×场景上架**（如 `pro2-video`）；模板是 **跨应用能力规则**，可并存。Shelf 管「某 app 可见谁」；模板管「这类生成用哪套规则 + 静态价」 |
| Fintech / 成本页 | 只影响成本与 Offering 选路，**不**写入模板 |

---

## 6. 子应用接入

| 应用 | 选模 | 估分 |
|------|------|------|
| canvas-web | 按 templateId 读静态包过滤；invoke 用 `resolved.modelKey` | `creditsPerUnit × units` |
| e-commerce-toolkit | 同上 | 同上 |
| quick-replica-web | 同上 | 同上 |
| story-web | 模型页按 role→模板过滤；分镜视频弹层按 i2v/t2v/v2v 过滤 | 可后续接 catalog 估分 |
| tool-web | 图生/文生/参考视频实验室按 mode→模板过滤 | 可后续接 catalog 估分 |
| common-tools | Gateway 图像模型列表 + 静态下拉按 i2i/t2i 过滤 | 可后续接 catalog 估分 |

**禁止**新模型只改前端白名单不上模板。

---

## 7. 验收清单

- [ ] Finance 可启停六类模板、绑定/解绑 canonical  
- [ ] 缺成本或未发布积分价时绑定失败并提示  
- [ ] 发布后 `catalog` API 返回 version + 模型含平台价与 resolved.modelKey  
- [ ] Canvas / 电商 / QR / Story / Tool / 常用工具能按模板过滤选模  
- [ ] 生成仍走 Gateway，日志 `model` = resolved.modelKey  
- [ ] 停用模板后重新发布，静态包不再包含该模板 ACTIVE 模型  

---

## 8. 相关文件

| 路径 | 作用 |
|------|------|
| `lib/platform-model/scene-templates.ts` | 规则类型、发布组装 |
| `scripts/seed-scene-templates.ts` | 种子六类 + 从 model-ops 映射绑定 |
| `finance-web/.../model-ops-scene-templates-tab.tsx` | 管理 UI |
| `app/api/finance/admin/scene-templates/` | 管理 API |
| `app/api/sso/tools/gateway/model-templates/catalog/` | 读目录 |

### 本地种子

```bash
cd book-mall
# 严格门禁（仅 ACTIVE offering + 成本 + 积分价）
pnpm gateway:seed-scene-templates
# 本地联调：跳过门禁尽量多绑（管理 UI 绑定仍强制门禁）
pnpm gateway:seed-scene-templates:skip-gate
```

