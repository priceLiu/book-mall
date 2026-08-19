# 需求开发计划：模型运营中心

- **创建日期**：2026-08-19
- **负责人**：平台团队
- **关联产品文档**：`doc/tech/gateway-unified-model-registry.md`
- **关联逻辑文档**：`doc/product/model-operations-center.md`（本文）

## 背景与目标

各子应用（Canvas、电商工具箱、QuickReplica、Story、Tool、Prompt-Optimizer）的模型选择来源分散：部分走 Gateway 统一注册表，部分硬编码 `*_KNOWN_MODELS` 或静态 catalog；对外「来源」展示（KIE/火山）不统一。

**目标**：在 Finance 后台建立「模型运营中心」，统一管理 **展示来源名（sourceLabel）** 与 **按应用/场景上架（AppModelShelf）**；各应用通过增强后的 `listModelsForApp` 获取模型列表。Gateway 凭证绑定与 invoke/日志链路不变。

## 概念分层

| 层 | 职责 | 管理入口 |
|----|------|----------|
| L1 技术注册 | canonical + GatewayModelRoute | `canonical-registry.ts` + seed |
| L2 凭证绑定 | GatewayVendorCredential | Gateway `:3005/dashboard/models` |
| L3 商业上架 | 定价、路由、ACTIVE/DEPRECATED | Finance「商业上架」Tab |
| L4 展示配置 | `sourceLabel`、封面、描述 | Finance「展示配置」Tab |
| L5 应用分发 | 按 app + scene 可见性/排序 | Finance「应用分发」Tab |

## sourceLabel 规则

解析优先级：**模型级覆盖（DB）** → **providerKind 默认**（KIE→第三方，VOLCENGINE→平台）→ **vendor 映射** → fallback。

首期：`providerKind=KIE` 默认「第三方」；可被模型级 `ModelCatalog.sourceLabel` 覆盖。

## AppModelShelf 可见性

```
可见 = gatewayPublished
     ∧ appTags 含 appTag
     ∧（Shelf 表对该 app+scene 无记录 → 兼容 ACTIVE；有记录 → status=ACTIVE）
     ∧（PLATFORM_CREDIT → offering ACTIVE + 已发布价）
     ∧（BYOK → providerKind ∈ boundKinds）
```

## 统一 API

- `GET /api/sso/tools/gateway/models/registry?app=&role=&sceneKey=`
- `GET/POST /api/finance/admin/model-shelf`
- `GET/POST /api/finance/admin/model-presentation`

`RegistryModelRow` 扩展：`sourceLabel`、`sortOrder`。

## Gateway 日志链路（不变）

列表 API 仅影响选模；invoke 仍走：

`modelKey` → `*-gateway-client` → `/api/gw/v1/*` → `createRequestLog` → `assertModelRegistered` → `finalizeRequestLog`

各应用 `clientPage` / `clientSource` 约定不变。

## 全应用接入清单

### 用户选模应用

| # | 应用 | appTag | 选模入口 | 状态 |
|---|------|--------|----------|------|
| 1 | canvas-web | `canvas` | EnginePicker / Dock pickers | 接入 registry + sceneKey |
| 2 | e-commerce-toolkit | `ecom` | StoryboardModelPickerDialog | sourceLabel + shelf |
| 3 | quick-replica-web | `quick-replica` | QrModelPicker 系列 | registry 按 scene |
| 4 | story-web | `story` | models 管理页 | registry |
| 5 | tool-web | `tool` | image-to-video lab 等 | registry |
| 6 | prompt-optimizer | `prompt-optimizer` | Vue model manager | BFF 动态拉取 |

### Canvas sceneKey

| sceneKey | 用途 |
|----------|------|
| `pro2-llm` | Pro2 文本/大纲 |
| `pro2-image` | Pro2 生图 |
| `pro2-video` | Pro2 分镜视频 |
| `sbv1-image` | sbv1 生图 |
| `sbv1-video` | sbv1 生视频 |
| `canvas-general` | 通用节点 |

### QuickReplica sceneKey

| sceneKey | 能力 |
|----------|------|
| `qr-t2i` | 文生图 |
| `qr-t2v` | 文生视频 |
| `qr-audio-tts` | 配音 |
| `qr-voice-clone` | 声音克隆 |
| `qr-motion-sync` | 动作同步 |
| `qr-music` / `qr-sfx` | 音乐 / 音效 |

### Ecom 子模块 API

- `storyboard/models`、`hand-craft/models`、`product-design/models`
- `seed-video/models`、`media-decompose/models`
- `image-processing`（含 common-tools 复用）

## 任务清单

- [x] 已阅读 `doc/README.md` 及 `gateway-unified-model-registry.md`
- [x] 已在 `doc/database/schema-changelog.md` 登记设计
- [x] Prisma：`ModelCatalog.sourceLabel` + `AppModelShelf`
- [x] `model-source-label.ts` + `app-model-shelf.ts`
- [x] 扩展 `listModelsForApp` + registry API
- [x] Seed + canonical `quick-replica`
- [x] Finance 三 Tab 运营中心
- [x] 各应用接入
- [x] 单元测试

## 验收标准

1. Finance 运营中心可编辑 sourceLabel、按 app/scene 上架/下架模型。
2. 各应用选模列表展示 `sourceLabel`（KIE 默认「第三方」）。
3. Shelf 下架后对应应用 API 不再返回该模型。
4. 选用模型生成后 Gateway 日志 `model` 与 `clientPage` 正确；`audit-gateway-registry-gaps` 无新增缺口。

## 备注

- `paramsSchema` 首期仍从代码 KNOWN 映射 enrich，不入 DB。
- Gateway 控制台凭证绑定 UI 不在本次范围。
- `ai-fit` 用户自定义模型不在 Gateway registry 范围。
- **新模型接入**须遵守 [23-new-model-onboarding-mandatory.md](./23-new-model-onboarding-mandatory.md)（Gateway + 运营中心 + 成本积分 + API 文档）。
