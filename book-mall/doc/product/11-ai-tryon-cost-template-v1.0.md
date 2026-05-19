# 需求规格：AI 试衣成本计算模板与对外报价（v1.0.0）

| 字段 | 值 |
| --- | --- |
| **文档版本** | `v1.0.0` |
| **需求类型** | 试衣模型（`fitting-room` / `fitting-room__ai-fit`）价格与成本体系变更 |
| **创建日期** | 2026-05-19 |
| **状态** | 已实施（v1.0.0 · 2026-05-19） |
| **关联财务总宪** | [`doc/finance/00-pricing-source-of-truth.md`](../finance/00-pricing-source-of-truth.md) |
| **关联发布文档** | [`doc/releases/2026-05-19-ai-tryon-cost-template-v1.0.md`](../releases/2026-05-19-ai-tryon-cost-template-v1.0.md)（发布后填写） |
| **云厂商挂牌基线** | `tool-web/doc/price_0518.md` § AI 试衣（与阿里云百炼官方报价一致） |

---

## 1. 背景与目标

阿里云 **AI 试衣** 产品线包含 4 个 API 模型，其中 `aitryon-refiner` 为 **按账期内累计生成张数分档** 的阶梯单价。当前平台：

- 已对 **成片试衣**（`fitting-room__ai-fit` / `try_on`）按 **固定成本 × M** 扣费，但仅覆盖 `aitryon`、`aitryon-plus` 两行 D 表；
- **未** 覆盖 `aitryon-parsing-v1`、`aitryon-refiner` 及 refiner 阶梯；
- 成本解析与视频「多档位 `cloudTierRaw`」类似，但 refiner 档位依据是 **累计用量** 而非单次分辨率。

**目标**

1. 建立 **按厂商 / 产品系列** 可扩展的 **成本价计算模板**（cost resolution template）；平台零售价公式不变：**对外单价 = 成本价 × M（当前 M = 2）**。
2. 以 **试衣（阿里云百炼）** 为首个落地系列：挂牌价按官方表定稿；对外公示与试衣间入口一致。
3. **界面展示形态不变**（价目表、财务明细、点数口径）；仅 **成本价解析** 与 **数据入库** 补齐，试衣间增加 **查看报价** 链接。

---

## 2. 已定产品规则

### 2.1 成本价与对外价

| 概念 | 规则 |
| --- | --- |
| **成本价（B）** | 云厂商 **挂牌价**（元/张），来源 `price_0518.md`；不含商务折扣 |
| **对外单价（平台零售价）** | **成本价 × M**，M = 2（与全站一致） |
| **扣点** | `pricePoints = round(对外单价 × 100)`；1 点 = ¥0.01 |
| **试衣对外公示** | 与全站 `/pricing-disclosure` 同源数据；试衣间须能 **链接打开** 试衣相关价目（见 §5） |

### 2.2 官方挂牌（中国内地，元/张）

| 模型服务 | modelKey | 成本价（元/张） | 阶梯层级 |
| --- | --- | ---: | --- |
| AI 试衣-基础版 | `aitryon` | 0.20 | 无 |
| AI 试衣-Plus 版 | `aitryon-plus` | 0.50 | 无 |
| AI 试衣-图片分割 | `aitryon-parsing-v1` | 0.004 | 无（按 **输入** 图张数计费，见 §4.3） |
| AI 试衣-图片精修 | `aitryon-refiner` | 见下表 | **按累计生成张数分档** |

**`aitryon-refiner` 阶梯（成本价，元/张）**

| 阶梯层级（生成数量） | 单价 |
| --- | ---: |
| ≤ 25 张 | 0.30 |
| 25 张 < 数量 ≤ 125 张 | 0.275 |
| 125 张 < 数量 ≤ 250 张 | 0.25 |
| 250 张 < 数量 ≤ 1250 张 | 0.225 |
| 1250 张 < 数量 ≤ 2500 张 | 0.20 |
| 2500 张 < 数量 ≤ 2.5 万张 | 0.175 |
| > 2.5 万张 | 0.15 |

对外公示价 = 上表 × 2（例如首档 0.30 → **¥0.60/张**）。

### 2.3 成本「计算模板」架构（全站方向）

```
挂牌基线 (B: price_0518.md / PricingSourceLine)
        ↓
成本解析模板 (costTemplateKey)  ←── 按厂商/系列注册
        ↓
unitCostYuan（本次适用的单位成本）
        ↓
既有平台规则：× M → pricePoints；WalletHold / settle / 财务 cloudRow 快照
```

| 模板 ID（建议） | 适用 | 输入 | 输出 |
| --- | --- | --- | --- |
| `aliyun.flat_per_image_v1` | `aitryon`、`aitryon-plus`、文生图等 | `modelKey`、可选 `cloudTierRaw` | 固定 `unitCostYuan` |
| `aliyun.ai_tryon_parsing_input_v1` | `aitryon-parsing-v1` | 本次 **输入** 张数 | 固定 0.004 元/张 × 张数 |
| `aliyun.ai_tryon_refiner_volume_tier_v1` | `aitryon-refiner` | **账期内累计** 生成张数 + 本次张数 | 命中阶梯后的 `unitCostYuan` |
| `aliyun.video_tier_by_resolution_v1` | 现有视频 | `videoSr`、`videoAudio` | 已有 `videoTierCandidates` 逻辑 |

**原则**：模板只负责解析 **成本价**；点数、公示列、管理后台 UI **不重做**，只扩展数据源与选行逻辑。

---

## 3. 两个前置问题（现状与目标）

### 3.1 用户用量如何记录？是否入库？

**结论：单次计费事件已入库；阶梯所需的「累计用量」尚未单独入库，开发 refiner 前必须补齐。**

| 数据 | 是否入库 | 表 / 字段 | 说明 |
| --- | --- | --- | --- |
| 每次成功扣费 | **是** | `ToolUsageEvent` | `userId`、`toolKey`、`action`、`costPoints`、`meta`(JSON)、`billedVideoSec`、可选 `walletHoldId` |
| 财务明细快照 | **是** | `ToolBillingDetailLine` | `cloudRow` JSON + `pricingTemplateKey`（如 `internal.tool_usage_v1`） |
| 试衣成片 meta | **是** | `ToolUsageEvent.meta` | 含 `taskId`、`modelId` / `tryOnModel`（如 `aitryon`）等；**当前无** `imageCount`、无 parsing/refiner 独立 action |
| 账期内累计张数（阶梯） | **否（缺口）** | — | 不能仅靠单次 `meta` 推 refiner 档位；需 **聚合或计数表** |

**写入路径（试衣成片）**

1. 工具站 `POST /api/ai-fit/try-on` 成功 → `postToolUsage` → 主站 `POST /api/sso/tools/usage`（`phase=settle` 或 `auto`）
2. 主站 `recordToolUsageAndConsumeWallet` 事务内创建 `ToolUsageEvent` + 扣钱包 + 写 `ToolBillingDetailLine`

**开发要求（v1.0.0 范围）**

- [ ] 凡走试衣相关模型的计费上报，`meta` 须带 **`modelId`**（已有）及 **`imageCount`**（默认 1，parsing 为输入张数）。
- [ ] 新增 **累计用量** 持久化（二选一，实施时定稿）：
  - **方案 A（推荐）**：表 `ToolModelUsageCounter`（`userId` + `modelKey` + `periodKey` + `quantity`），每次 settle 递增；`periodKey` 与云账单周期对齐规则写清。
  - **方案 B**：按 `ToolUsageEvent` 聚合（`SUM` meta 张数），需索引与周期边界；实时 settle 压力大。
- [ ] `aitryon-refiner` settle 前：读累计量 → 选阶梯 → 得 `unitCostYuan` → 再走现有 `× M` 算点。

### 3.2 模型价格如何保存？是否入库？

**结论：是，分三层；试衣 4 模型须全部可追溯到库内行。**

| 层级 | 表 | 作用 | 试衣现状 |
| --- | --- | --- | --- |
| **B 价目快照** | `PricingSourceVersion` + `PricingSourceLine` | 从 `price_0518.md` 导入的挂牌行；`modelKey` + `tierRaw` + `costJson` | 需导入/补齐 4 模型；refiner 多行 `tierRaw` |
| **D 扣点真源** | `ToolBillablePrice` | `schemeAUnitCostYuan`、`cloudTierRaw`、`pricePoints`、M；**settle 查此行** | 仅有 `aitryon`、`aitryon-plus` 两行 `try_on` |
| **模型目录** | `ModelCatalog` + `ModelAlias` | 展示名、厂商 5 列、别名反查 | 迁移 `20260519120000` 入库 4 个 canonical（见 schema-changelog） |
| **C 工具站预估** | `tool-web/config/tools-scheme-a-catalog.json` | reserve 估价 | 仅 `aitryon`、`aitryon-plus` |

**开发要求**

- [ ] `pricing-realign-from-price-md.ts` / `inspect-billable-vs-price-md.ts`：扩展 `PRICE_MD` + `EXPECTATIONS`（含 parsing、refiner 7 档）。
- [ ] `ToolBillablePrice`：refiner **7 行** `cloudTierRaw`（与 `PricingSourceLine.tierRaw` 一致）；parsing 至少 1 行（可共用 `fitting-room__ai-fit` 或新 `action`）。
- [ ] `resolveBillableSnapshot`：注册 refiner 模板，按累计量选 `cloudTierRaw` 行（类比 `videoTierCandidates`）。
- [ ] catalog C：单价 ≥ D，refiner reserve 用 **保守价**（当前档或更高档）防 under-hold。

---

## 4. 范围

### 4.1 本版本包含（In scope）

- 需求与发布文档（本文 + release）
- `ModelCatalog` / `ModelAlias` 四模型入库（迁移已提供）
- 成本模板注册与试衣系列接入设计
- 价目公示：试衣块可链接（锚点或 query）
- 工具站试衣间 / AI 试衣页：**「价格说明」** 链到主站公示

### 4.2 本版本不包含（Out of scope）

- 非阿里云厂商模板实现（仅预留 `costTemplateKey` 扩展点）
- parsing / refiner **业务 API** 全量接入（若尚未调用，可先价目入库 + 占位 action）
- 改 M、改订阅价、改财务 UI 布局

### 4.3 计费维度差异（实施注意）

| modelKey | 云厂商计费维度 | 平台 `billingKind` 建议 | 用量字段 |
| --- | --- | --- | --- |
| `aitryon` / `aitryon-plus` | 输出张数 | `OUTPUT_IMAGE` | `imageCount`（输出，默认 1） |
| `aitryon-parsing-v1` | **输入**张数 | `COST_PER_IMAGE` | `imageCount`（**输入**） |
| `aitryon-refiner` | 输出张数 + 阶梯 | `OUTPUT_IMAGE` + 模板 | 累计 + 本次 `imageCount` |

---

## 5. 链接与展示（试衣间 → 报价）

| 入口 | 目标 URL | 说明 |
| --- | --- | --- |
| 工具站 · 试衣间 / AI 试衣 | `{MAIN_SITE}/pricing-disclosure#ai-tryon` | `FittingRoomPricingLink`；**唯一**工具站价目入口 |
| 工具站 · 视觉实验室分析室等 | `{MAIN_SITE}/pricing-disclosure#all-tools` | 链主站「其他工具」小节，**不再**使用站内 `/app-history/price-list` |
| 主站 · `/pricing-disclosure` | 按次扣费统一公示 | 试衣 `#ai-tryon`、其余 `#all-tools`；管理员可见成本/系数/公式 |
| 主站 · 个人中心价目 | `/pricing-disclosure?from=account` | `/account/pricing` 重定向；**始终**隐藏成本、系数、计价公式（含管理员） |

**已下线（v1.0.1）**：工具站 `/app-history/price-list` 及 `GET /api/tool-billable-prices` 聚合接口，避免与主站双份价目。

**不变**：列结构、M=2、点数公式、管理后台价目编辑交互（在财务后台，非重复前台页）。

---

## 6. 验收标准

1. **数据**：四模型在 `ModelCatalog` 存在且 `ModelAlias`（`INTERNAL_SCHEME_A_MODEL`）可反查；D 表成本与 `price_0518.md` 一致（`pnpm pricing:inspect-billable-vs-md` 通过）。
2. **成片试衣**：`aitryon` / `aitryon-plus` 扣点仍为 成本×M×张数；公示与试衣链接可打开。
3. **refiner（若 API 已上线）**：同一用户账期内第 N 张按正确阶梯 cost 扣费；`ToolUsageEvent` / `ToolBillingDetailLine` 可审计档位与累计量。
4. **parsing（若 API 已上线）**：按输入张数 × 0.004 × M 扣费。
5. **发布**：填写 [`2026-05-19-ai-tryon-cost-template-v1.0.md`](../releases/2026-05-19-ai-tryon-cost-template-v1.0.md) 部署步骤与回滚说明。

---

## 7. 开发任务清单（实施勾选）

- [ ] 扩展 `PRICE_MD` / `EXPECTATIONS` / `pricing:realign-from-md:apply`
- [ ] 实现 `aliyun.ai_tryon_refiner_volume_tier_v1` + 累计用量表（或等价）
- [ ] `resolveBillableSnapshot` / usage API 接入模板选行
- [ ] 公示页 `#ai-tryon` 小节 + 试衣间链接
- [ ] catalog C 同步四模型
- [ ] parsing/refiner 工具站 settle（若产品启用）
- [ ] 更新 `doc/database/schema-changelog.md`
- [ ] 发布文档勾选完成项

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0.1 | 2026-05-19 | 删除工具站重复「价格表」页与 `tool-billable-prices` API；价目仅主站 `/pricing-disclosure`；个人中心 `?from=account` 隐藏成本/系数/公式 |
| v1.0.0 | 2026-05-19 | 初版：试衣四模型挂牌、成本模板方向、用量/价库现状与缺口、链接要求 |
