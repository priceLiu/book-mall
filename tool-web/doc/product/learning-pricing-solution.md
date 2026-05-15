# 学习端 · 轻量报价体系 — 解决方案

> 对应需求：`learning-pricing-requirements.md`。  
> 本文描述 **可执行** 的定价规则、数据落地方式、与主站计费衔接思路，以及 **复制到新平台** 时的检查清单。  
> **★ 开发新工具 / 新模型 / 计费相关能力前，须先读 §0（重大成果）**，再读 §1 及以下。  
> **上架工作单**：`doc/product/learning-pricing-tool-onboarding-worksheet.md`；定价入库与工具站同步流程见 **§5.6**、**§5.7（方案 A）**。

---

## 0. 重大成果：模型单独计价 · 系统算成本 · 系数按模型（**开发必读**）

<a id="major-pricing-outcomes"></a>

> **本节是 2026-05 以来方案 A 的关键落地结论**，替代「全工具一口价 + 全局统一倍数」的旧心智。  
> **在 tool-web、book-mall 内实现或扩展任何与工具扣费、标价、SSO 倍率、上架定价相关的功能时，必须先理解本节，再查阅 §1～§5 的细节。**

### 0.1 三件一体（须同时满足）

| 维度 | 含义 | 工程/运维要点 |
|------|------|----------------|
| **模型单独计价** | 同一 **`toolKey`** 下，**每个可售模型**（主站 **`ToolBillablePrice.schemeARefModelKey`** ≡ 工具站上报/查询时的 **`modelId` / `modelKey`**）对应 **独立定价逻辑与生效行**；多模型工具 **不得**用单一口价行糊弄所有模型。 | 分析室、试衣多模型、视频多规格等：每暴露一个模型，须有可稽核的 **行级** 配置与 **`usage`/SSO 命中键**。 |
| **成本由系统计算** | **方案 A 单位成本（元）** 的主线来自 **主站 `PricingSourceLine`（中国内地价目）** + **`pricing-catalog-sync-map.json`** + **`pnpm pricing:emit-catalogs`**；主站后台「新增定价」对模型 **预填 `schemeAUnitCostYuan`**，与 **`price.md`/导入** 同源。 | 运营 **不应**脱离价目链长期手编成本；手填仅作过渡，须补 **import / 映射 / 工作单**（§5.6）。 |
| **系数 \(M\) 按模型自定** | **零售倍数** 持久化在 **`ToolBillablePrice.schemeAAdminRetailMultiplier`**，**逐行（即逐工具+逐参考模型）** 维护；运行时 **`GET /api/sso/tools/scheme-a-retail-multiplier?toolKey=&modelKey=`** **按行命中** 该行 \(M\)。 | **已删除**全局系数表与「按模型覆盖表」第三真源（§5.4.3）；**不同模型可以、也应当能配置不同 \(M\)**。 |

**对外零售价（人民币）** 仍遵守 §1：**零售价 = 成本 × \(M\)**，再换算点数（**1 点 = 1 分**）；变化在于：**成本与 \(M\) 的粒度都以「模型（行）」为单位**，而非整块业务一个数。

### 0.2 当前默认：\(M\) 多为 2.0

- **现状**：已配置的各模型定价行中，**`schemeAAdminRetailMultiplier` 普遍为 `2.0`**，与历史产品口径「官网成本 × 2」一致，便于验算与客服解释。  
- **语义**：字段 **不是**「全站锁死 2.0」——**pricing 行上写什么，SSO 就回什么**；若未来对部分模型需要 **1.8、2.2** 等策略，**只改对应模型的 `ToolBillablePrice` 行** 即可，无需改代码常量。  
- **兜底**：未命中行或字段不完整时，实现里仍可能有 **\(M=2\)** 的应急路径（§1）；**生产环境应通过补全定价行消除此类兜底**。

### 0.3 开发自检（新工具 / 新模型上架前勾一遍）

1. [ ] 每个要在界面可选的模型，是否已有 **`toolKey` + `schemeARefModelKey`（≈ `modelId`）** 的 **`ToolBillablePrice` 生效行**？  
2. [ ] **成本** 是否可由 **价目库 + sync map + emit** 解释（或 PR/工作单是否已说明临时手填与补链路计划）？  
3. [ ] 工具站 **SSO / `usage` 上报** 中的 **`modelKey`** 是否与主站行 **字符串完全一致**？  
4. [ ] 是否知悉：**已有行**在后台 **仅允许补一次「生效止」**；改 **\(M\)** 或改 **成本** 须 **新增定价行**（§5.4.1），避免在线改价破坏稽核？

### 0.4 与当前实现结论（对照）

下列为 **§0 口号与 book-mall / tool-web 现状** 的一一核对，便于产品、研发、运维统一判断是否「已经做成文档里说的那样」。

| 文档归纳 | 当前实现要点 |
|----------|----------------|
| **模型单独计价** | **是**。同一 **`toolKey`** 下按 **`ToolBillablePrice.schemeARefModelKey`** 分行，与工具站 **`modelId`**、SSO **`modelKey`** 对齐；扣费与 **`GET /api/sso/tools/scheme-a-retail-multiplier`** 均按 **`toolKey` + `modelKey`** 命中**该行**。 |
| **成本系统计算** | **是**（**系统按价目链给出参考成本**）：**`PricingSourceLine`** + **`pricing-catalog-sync-map.json`** + **`loadSchemeAModelCatalog`**（及 **`pnpm pricing:emit-catalogs`** 回填 catalog）形成闭环；后台「新增定价」**预填 `schemeAUnitCostYuan`**。**仍允许手填成本**作过渡，但主线是价目链 + 预填，不以手编为常态。 |
| **系数按模型自定** | **是**。每条定价行独立 **`schemeAAdminRetailMultiplier`**，SSO **按行**返回 \(M\)；已删除全局/覆盖系数表（§5.4.3）。 |
| **现在都是 2.0** | 指 **现网配置习惯与兜底**：各行 **`schemeAAdminRetailMultiplier` 多为 `2.0`**；**代码未写死**「全系必须 2」——行上写什么 SSO 回什么，可按模型改为非 2。缺行或字段不全时，实现上仍有 **\(M=2\)** 等兜底（§1），生产应靠**补全定价行**收口。**迁移/seed 不会自动把该列写成 2.0，库内可为 NULL**，实测见 **§0.5**。 |

**结论**：**§0 所述「重大成果」与当前数据模型、主站与工具站结算路径一致**；「**都是 2.0**」应理解为 **当前常见配置与应急兜底**，**不是**程序里只允许 2.0。若需证明「库表里是否恰好全为 2.0」，须直接查询 **`ToolBillablePrice.schemeAAdminRetailMultiplier`**（属数据稽核，非本文替代）。

### 0.5 仓库与数据库核查说明（否定「未查库即可断言全是 2.0」）

对 **本仓库 + Prisma 迁移** 的核查结论如下（截至文档修订日）：

| 核查项 | 结论 |
|--------|------|
| **迁移是否把 `schemeAAdminRetailMultiplier` 写成 2.0？** | **否**。`20260624120000_tool_billable_price_cost_and_admin_mult` **仅新增可空列**，其后迁移 **无** 对全表 `UPDATE` 将该列批量设为 `2` 或 `2.0`。 |
| **`seed.ts` 是否写入定价行？** | **否**。`prisma/seed.ts` **不创建/更新** `ToolBillablePrice`。 |
| **仅 migrate、未走后台「新增定价」补列时？** | 历史行上 **`schemeAAdminRetailMultiplier` / `schemeAUnitCostYuan` 可为 `NULL`**；运行时 SSO 可走 **由 `pricePoints` 与成本反推** 或 **§1 兜底 \(M=2\)**（见 `tool-scheme-a-resolve-retail-multiplier.ts`）。这与「库中已持久化全是 2.0」**不是同一句话**。 |
| **如何得到某一环境的真实分布？** | 在该环境配置 **`DATABASE_URL`** 后执行 SQL（或 Prisma 查询），例如：  
`SELECT "schemeAAdminRetailMultiplier", COUNT(*) AS n FROM "ToolBillablePrice" GROUP BY "schemeAAdminRetailMultiplier" ORDER BY n DESC;`  
并另行统计 **`WHERE "schemeAAdminRetailMultiplier" IS NULL`** 的行数。 |

**文档中「现网多为 2.0」**：指 **产品配置惯例**与 **后台「新增定价」表单默认系数为 2**、以及 **未命中时的兜底 2**，**不能**替代上表 SQL 在你方 **staging/production** 上的实测结果。

---

## 1. 核心公式（必须统一）

\[
\text{对外零售价（人民币）} = \text{成本单价（人民币，中国内地官方价目）} \times \textbf{RETAIL\_MULTIPLIER}
\]

- **RETAIL_MULTIPLIER（运行时 \(M\)）**：**每条工具按次标价行各自持久化**，见主站 **`ToolBillablePrice`** 字段 **`schemeAAdminRetailMultiplier`**（及 **`schemeAUnitCostYuan`**，与 \(M\) 相乘写入 **`pricePoints`**）。工具站通过 **`GET /api/sso/tools/scheme-a-retail-multiplier?toolKey=&modelKey=`**（Bearer `tools_token`）解析：在当前时刻命中 **`active` + 生效区间** 内、且 **`schemeARefModelKey`** 与查询 **`modelKey`** 一致的行，优先取该行 **`schemeAAdminRetailMultiplier`**；若缺失则用 **`pricePoints` + `schemeAUnitCostYuan`** 反推；仍不可得时 **代码兜底 \(M=2\)**（应急，配置应补齐定价行）。工具站 **`scheme-a-retail-multiplier-server.ts`** 约 **30 秒内存缓存**；拉主站失败时回退 **`tools-scheme-a-catalog.json` / `visual-lab-analysis-scheme-a-catalog.json` 中的 `retailMultiplier`（默认 2）**。  
  - **历史**：曾使用 **`ToolRetailMultiplierRule`（全局）** + **`ToolSchemeAModelRetailMultiplier`（按模型覆盖）**，与「每条 `ToolBillablePrice` 已填 \(M\)」重复、易出现两套真源；已在迁移 **`20260625120000_drop_tool_scheme_a_retail_multiplier_tables`** 中 **删表**，系数以定价行为准。详见 **§5.4**。  
- **舍入**：建议 **向用户展示** 保留 2～4 位小数或「约 X 元」整数档，**实际扣费** 以主站 `PlatformConfig` / 工具定价 **分为单位** 存储，避免浮点误差；具体舍入策略在实现阶段由研发选定一种并写入代码注释。

---

## 2. 地域与数据源

| 项 | 约定 |
|----|------|
| 地域 | **仅中国内地** 价目；`price.md` 中「全球 / 国际 / 欧盟 / 美国」章节 **不参与** 学习端首期配置。 |
| 成本来源 | 以 **阿里云百炼文档 / 控制台** 当前中国内地价为准；仓库内 `doc/price.md` 为 **快照备查**，更新价目时 **人工对比** 官网后改配置。 |
| 免赔 | 官方调价滞后可导致短时不一致；产品公告或站内「定价更新日期」可减轻争议。 |

---

## 3. 对「免费额度」的表述

- **对客**：不将百炼免费额度叙述为 **本产品权益**；必要处写「第三方可能有官方试用政策，详见其官网」。  
- **对产品/研发**：内部仍可按云账号在控制台观察用量；**不在学习端钱包逻辑中依赖「免费额度抵扣用户应付」**。

---

## 4. 数据落地（小配置 + **可解析准则** + 可追溯）

**原则（方案 A）**：**中国内地成本的唯一真源是主站（book-mall）数据库** `PricingSourceVersion` / `PricingSourceLine`（当前版本 `isCurrent=true`）。工具站 scheme A 的 **`visual-lab-analysis-scheme-a-catalog.json` / `tools-scheme-a-catalog.json` 仅作运行镜像**：其中 **与上游成本相关的数字**（Token 入出元价、试衣/文生图元价、视频 spec）须由 **`pnpm pricing:emit-catalogs`** 从库 **生成或覆盖**，**禁止为改成本而手改 JSON**；`retailMultiplier`、分析室 **等价用量**、视频目录结构仍可在 JSON 中维护（与库无关的字段）。溯源：每次导入写入 `sourceSha256`、`PricingLineChangeEvent` diff。

| 层次 | 内容 |
|------|------|
| **准则文档** | `tool-web/doc/price.md`：与百炼官网 **中国内地** 对齐的快照；**修订须留 Git 历史**。 |
| **机器快照（稽核）** | 仍可使用 **`pnpm pricing:extract-price-md`** → `config/generated/price-md-china-mainland-extract.json`（含 `meta.sourceSha256`、`warnings`），与 `price.md` 同 PR 更新；**不替代**库内 `PricingSourceLine`。 |
| **成本真源** | **book-mall DB** 当前价目版本；首次由 **`pnpm pricing:bootstrap`** 写入（`price.md` Token 行 + `tools-scheme-a-catalog.json` 非 Token 行），此后用 **`pnpm pricing:import-markdown`**（只替换 Token）、**`pnpm pricing:import-csv`** 或 **Admin `POST /api/admin/pricing/import`** 更新。 |
| **解析一致性** | **Markdown**：`parsePriceMdChinaMainlandTokenTables`；**CSV**：须含可映射到规范列的首行（见 `book-mall/lib/pricing/canonical-csv.ts`）。列名或列序不一致时 **`pnpm pricing:normalize-upload-csv`** → 规范 CSV 再导入。 |
| **运行时镜像（tool-web）** | `config/visual-lab-analysis-scheme-a-catalog.json`、`config/tools-scheme-a-catalog.json`；**成本字段** 与库的映射由 **`tool-web/config/pricing-catalog-sync-map.json`** 定义，`emit` 时按 `catalogId` ↔ `modelKey` + `tierRaw` + `billingKind` 回填。 |

**零售价**：`retailCny = costCny × M`（\(M\) 见 **§1**、**§5.4**，以 **`ToolBillablePrice`** 行为准）；**点数** `max(1, round(retailCny × 100))`。详见 **§5.6**、**§5.7** 与 **`learning-pricing-tool-onboarding-worksheet.md`**。

---

## 5. 与主站（book-mall）衔接

1. **展示层**：工具站页面从配置读取 **零售价**（或预计算表），与「费用说明」页一致。  
2. **扣费层**：主站工具管理里配置的单价应与 **零售价策略一致**（人工或脚本根据 catalog 填 `建议零售` 仅供运营复制）。  
3. **稽核**：定期抽样对比 `ToolUsageEvent` 金额与 `retailCny × 次数（或计量）` 是否一致。  
4. **阶梯 / Token 模型**（若未来需要）：costBasis 扩展为分段结构；首期若仅为「按次一口价」，保持单档即可。

### 5.1 若产品侧使用「点数」

主站钱包以 **`balanceMinor`（分）** 记账；**扣费与标价亦为分**。学习端若统一称「点」，推荐 **1 点 = 1 分**，与充值、扣费、`introspect` 的 `balance_minor` **同一数值**，勿建第二套余额。详见 **`learning-pricing-wallet-points.md`**。

### 5.2 视觉实验室 · 分析室（方案 A · 已落地）

- **成本真源**：主站 **`PricingSourceLine`**（`TOKEN_IN_OUT`）；同步见 **§5.7**。  
- **运行配置**：`config/visual-lab-analysis-scheme-a-catalog.json` 中 **入/出元价** 由 **`pnpm pricing:emit-catalogs`** 写入；官网中国内地档位须与导入用的 `price.md` / CSV 一致。  
- **等价用量**：目录内 `defaultEquivalentInputMillion` / `defaultEquivalentOutputMillion`（可按模型覆盖）；单次成本（元）= 等价入 × 入项单价 + 等价出 × 出项单价。  
- **零售与点数**：**零售元 = 成本 × \(M\)**，**\(M\)** 来自 **当前 `visual-lab__analysis` + 模型在 `ToolBillablePrice` 上生效的配置**（§1、§5.4，与 SSO 同源）；**扣费点数 = max(1, round(零售元 × 100))**，与主站钱包「点 = 分」一致。  
- **主站**：工具站 `POST /api/sso/tools/usage` 携带服务端计算的 **`costPoints`**；主站 `ToolBillablePrice` 中历史「分析室 invoke 一口价」行已停用，避免与按模型价冲突。

### 5.3 分析室方案 A — **实施结果**（重要｜对外可引用）

本节记录 **2026-05 落地后** 的真实行为与验算方式，便于产品、客服与研发统一口径；与上文 §1、§5.2 一致。

#### 5.3.1 `doc/price.md` 与配置的关系（易错点）

| 问题 | 结论 |
|------|------|
| **上架定价**时成本从哪来？ | **主站 DB** 当前 `PricingSourceLine`，由 `price.md` / 规范 CSV / Admin 导入写入；再 **`pnpm pricing:emit-catalogs`** 回写工具站 JSON（§5.7）。**禁止为改成本而手改 catalog 入出元价。** |
| 扣费运行时是否读取 `price.md`？ | **否**。在线以 **scheme A catalog JSON** 为准（其成本列须已与库同步）。 |
| 单价从哪来？ | 工程运行时用 **`tool-web/config/visual-lab-analysis-scheme-a-catalog.json`**（及 tools-scheme-a）；须与库内 Token 行及 **§5.7 映射表** 一致。 |
| 官方调价怎么办？ | 对照官网 → 更新 **`price.md`** → **`pnpm pricing:import-markdown`**（或 CSV / Admin）更新库 → **`pnpm pricing:emit-catalogs`** → 提交 PR（含追溯与工作单）。 |

因此：**留痕与成本** 是 **`PricingSourceVersion` + `price.md` / 上传文件哈希** 一条链；**线上扣费** 仍是 **已同步的 catalog + 定价行解析的 \(M\)**（§5.4）。

#### 5.3.2 单次扣费计算公式（与实扣一致）

对「当前选中的分析室 `modelId`」：

1. **成本（人民币，元）**  
   \(\text{costYuan} = \text{eqIn} \times \text{inputYuanPerMillion} + \text{eqOut} \times \text{outputYuanPerMillion}\)  
   - `eqIn` / `eqOut`：目录中 `defaultEquivalentInputMillion` / `defaultEquivalentOutputMillion`，或该模型条目的 `equivalentInputMillion` / `equivalentOutputMillion` 覆盖值（**百万 Token** 为单位）。

2. **零售价（人民币，元）**  
   \(\text{retailYuan} = \text{costYuan} \times M\)，其中 \(M\) 为 **当前工具+模型在 `ToolBillablePrice` 上生效的系数**（§1、§5.4；与 SSO `scheme-a-retail-multiplier` 同源）；文档验算可取与后台该行一致的 \(M\)（常见 **2.0**）。

3. **扣费点数**  
   \(\text{pricePoints} = \max(1, \mathrm{round}(\text{retailYuan} \times 100))\)  
   与主站钱包约定 **1 点 = 1 分** 一致，展示 **¥(pricePoints/100)** 即零售价。

**同一套等价用量下，不同模型的 `inputYuanPerMillion` / `outputYuanPerMillion` 不同 → 单次点数不同**（例如 Flash 系列通常低于 Plus）。

#### 5.3.3 验算示例（默认等价用量 + 默认推荐模型）

当前目录默认：**等价入 `0.35` 百万 Token、等价出 `0.57` 百万 Token**。  
模型 **Qwen3.6-Plus**（`qwen3.6-plus`）目录标价为：入 **2** 元/百万、出 **12** 元/百万（中国内地首档）。

- \(\text{costYuan} = 0.35 \times 2 + 0.57 \times 12 = 0.7 + 6.84 = 7.54\)。  
- \(\text{retailYuan} = 7.54 \times 2 = 15.08\)。  
- \(\text{pricePoints} = \mathrm{round}(15.08 \times 100) = 1508\)，即 **每次 ¥15.08（1508 点）**。

换其他 `modelId` 时，以 catalog 中该模型的入/出单价为准得到单次点数（价格表页「方案 A」区块与 `/api/visual-lab/billable-hint?modelId=` 与实扣同源）。

#### 5.3.4 工程落点（便于代码审查与排障）

| 用途 | 位置 |
|------|------|
| 定价真源（JSON） | **`tool-web/config/visual-lab-analysis-scheme-a-catalog.json`**（成本数字须由 emit 同步） |
| 计算与价格表行生成 | `tool-web/lib/visual-lab-analysis-scheme-a.ts` |
| 分析请求扣费（服务端算 `costPoints` 上报主站） | `tool-web/app/api/visual-lab/analysis/route.ts` |
| 前端单次标价提示 | `GET tool-web/app/api/visual-lab/billable-hint/route.ts`（Query：`modelId`） |
| 「价格表」页：主站标价 + 分析室按模型表 | `tool-web/app/api/tool-billable-prices/route.ts`（剔除旧 `visual-lab__analysis`/`invoke` 行，附加 `analysisSchemeA`）；页面 `app-history/price-list/price-list-client.tsx` |
| 上报主站 body | `tool-web/lib/forward-tools-usage-server.ts` 可选字段 `costPoints` |
| 流水 meta（稽核） | 分析接口写入 `meta`：`modelId`、`pricingScheme: visual_lab_scheme_a`、`equivalentInputMillionTokens`、`equivalentOutputMillionTokens`、`costYuanUpstreamApprox`、`retailMultiplier`、`retailYuanApprox` 等 |

#### 5.3.5 主站数据库（book-mall）

- 迁移 **`20260617120000_tool_billable_visual_lab_analysis_scheme_a_deactivate`**：将 `ToolBillablePrice.id = seed_tbprice_visual_lab_analysis_invoke`（`visual-lab__analysis` / `invoke`）设为 **`active = false`**，并更新说明，避免与工具站动态 `costPoints` 双轨标价。  
- 扣费：主站 **`POST /api/sso/tools/usage`** 在 body 中带 **`costPoints`**（正整数）时 **优先采用**，不再依赖该停用行的 `pricePoints`。

### 5.4 零售系数 \(M\)：按 `ToolBillablePrice` 定价行（当前实现）

**目标**：**一处维护、与实扣一致**——每个可售「工具 + 方案 A 模型」在 **主站「工具管理 → 按次单价」** 对应 **`ToolBillablePrice`** 行；该行上的 **成本（元）**、**系数 \(M\)** 与 **`pricePoints`（点）** 由后台表单统一生成，工具站 **仅通过 SSO 按 `toolKey` + `modelKey`（与行的 `schemeARefModelKey` 一致）** 读回 **运行时 \(M\)**，与 settle / 分析室 / 试衣等同源。

#### 5.4.1 主站后台：添加与维护「按次单价」

- **入口**：book-mall **`/admin/tool-apps/manage`**（Card「按次单价」）。  
- **流程（产品逻辑）**：  
  1. **新增定价**（表格下方）：填写 **工具标识**（`toolKey`、`action` 可空或 `invoke` / `try_on` 等）、生效区间、启用、备注。  
  2. **参考模型**（仅新增表单）：若该工具在 **价目库 + `tool-web/config/pricing-catalog-sync-map.json`** 下有映射，表单提供 **可筛选的建议浮层**（`fixed` 定位、与输入同宽且 **最小约 320px**、分层阴影）；可选用 **catalog 模型 id** 或 **手填**同一字符串（写入 **`schemeARefModelKey`**，须与工具站 **`modelId`** 一致）；服务端用当前 **`PricingSourceLine`** 算出 **方案 A 单位成本（元）** 并预填 **`schemeAUnitCostYuan`**（**可改**）。价目未匹配时界面会提示，仍可先 **手填成本** 保存，再补 import / 映射。  
  3. 填写 **零售系数 \(M\)**（**`schemeAAdminRetailMultiplier`**，须为正数）。  
  4. **单价（点）只读展示**：`pricePoints = round(成本 × M × 100)`（**100 点 = 1 元**），保存时由 **Server Action** 写入库，**不可在表单中直接改点数**。  
  5. **已有行**：表格中每条历史定价 **仅当当前 `effectiveTo` 为空（长期有效）时**，可**填一次**生效止（北京时间）并保存；**已设结束时间的行不再允许修改**，避免反复改区间；调价须 **再「新增定价」** 一条。**`updateToolBillablePrice`** 仅更新 **`effectiveTo`**，且服务端校验库中该行 **`effectiveTo` 仍为空** 才接受。  
- **工程落点**：  
  - 价目 + sync map 加载、默认成本：`book-mall/lib/tool-billable-scheme-a-admin-cost.ts`（仅服务端；客户端纯函数在 **`tool-billable-scheme-a-shared.ts`**）。  
  - 表格与表单 UI：`book-mall/components/admin/admin-tool-billable-pricing.tsx`。  
  - 行初始成本/系数（旧数据反推）：`book-mall/lib/tool-billable-row-initial.ts`。  
  - 写入：`book-mall/app/actions/tool-apps-admin.ts`（`createToolBillablePrice` / `updateToolBillablePrice`）。

#### 5.4.2 运行时如何解析 \(M\)（SSO）

- **`GET /api/sso/tools/scheme-a-retail-multiplier`**（book-mall，需 `tools_token`）：  
  - 查询 **`toolKey`、`modelKey`**（工具站须与定价行一致，例如试衣 **`fitting-room__ai-fit`** + catalog 试衣模型 id）。  
  - 命中 **当前生效** 的 **`ToolBillablePrice`**（`active`、`effectiveFrom` / `effectiveTo`、`schemeARefModelKey = modelKey`）后返回 **`multiplier`**；响应含 **`billablePriceId`**（命中行 id）。  
  - 字段 **`ruleId` / `overrideId` 已废弃，恒为 `null`**（兼容旧客户端字段名）。  
- **解析实现**：`book-mall/lib/tool-scheme-a-resolve-retail-multiplier.ts`。  
- **工具站缓存**：`tool-web/lib/scheme-a-retail-multiplier-server.ts`（按 `toolKey::modelKey` 分桶）；**`ruleId` 若存在则与 `billablePriceId` 同义回填**。

#### 5.4.3 为何去掉「全局 / 按模型系数表」

| 原设计 | 问题 |
|--------|------|
| **`ToolRetailMultiplierRule`**：全站默认 \(M\)（如 2.0） | 与「**每条 `ToolBillablePrice` 已存 \(M\)**」重复；调价时要猜究竟改全局还是改行。 |
| **`ToolSchemeAModelRetailMultiplier`**：`toolKey + modelKey` 覆盖 | 再与定价行上的 **`schemeAAdminRetailMultiplier`** 形成 **第三处** 配置，易产生「标价按行算、实扣却走覆盖表」不一致。 |

**结论**：以 **`ToolBillablePrice`** 为 **\(M\) 与标价的唯一配置面**；删除上述两表（迁移 **`20260625120000_drop_tool_scheme_a_retail_multiplier_tables`**），降低心智负担与稽核成本。

#### 5.4.4 遗留与已知缺口

- **必须有行**：某 **`toolKey` + `modelKey`** 若无对应 **`schemeARefModelKey`** 的生效定价行，SSO **兜底 \(M=2\)**，可能与真实标价 **不一致**——**上架新模型时务必在工具管理补行**（§5.6）。  
- **旧行缺列**：历史 **`ToolBillablePrice`** 可能仅有 **`pricePoints`** 而无 **`schemeAUnitCostYuan` / `schemeAAdminRetailMultiplier`**；后台打开时用 **标价与成本反推** 预填（`tool-billable-row-initial.ts`），仍建议 **保存一次** 补全持久化字段。  
- **JSON `retailMultiplier`**：`tools-scheme-a-catalog.json` 等仍为 **主站不可用时的回退**（与定价行 **独立**）；**不得以 JSON 替代** 「应有定价行」。  
- **Admin 文案/文档**：部分旧段落若仍写「全局规则表」，以 **本节为准**。  
- **部署**：`loadSchemeAModelCatalog` 等默认从 **`book-mall` 工作目录旁的 `../tool-web`** 读 `pricing-catalog-sync-map.json`；若 **仅部署 book-mall** 且目录布局不同，须自行保证映射文件可读或调整路径。

#### 5.4.5 运维改 \(M\)（当前）

- **按模型**：编辑对应 **`ToolBillablePrice`** 行的 **成本** 与/或 **\(M\)**，保存后 **`pricePoints` 重算**；必要时用 **生效区间** 做排期（新行 `effectiveFrom` 晚于旧行）。  
- **不再有**「单独插入全局规则 / 按模型覆盖表」步骤。

#### 5.4.6 新工具 / 新模型：不会自动「入池」；如何可选、可上架

**结论（对应产品常见疑问）**：

| 情景 | 价目库 / sync map / 工具站是否会**自动新增**？ | 运维应怎么做 |
|------|-----------------------------------------------|-------------|
| **全新工具 + 全新模型** | **否**。匹配不到时不会向 **`PricingSourceLine`**、**`pricing-catalog-sync-map.json`**、工具站 **`*-models.json` / scheme A catalog** 或 **`ToolBillablePrice`** 自动 `insert`。 | 按下列 **A** 清单新建 `toolKey`、导航、映射、import、emit、后台定价行。 |
| **已有工具 + 新模型** | **否**。用户**不能**仅在运行时「选到」尚未写进工具站模型清单的模型。 | 按下列 **B** 把模型写进清单并走完映射与标价；主站「按次单价」可用 **建议列表 + 手填 `schemeARefModelKey`**（见 `admin-tool-billable-pricing.tsx`）。 |

**A — 全新工具（方案 A）上架最小闭环**：

1. **tool-web**：`toolKey`、路由与侧栏（与主站、SSO 一致）。  
2. **成本**：`price.md` / CSV → book-mall **import** → **`pnpm pricing:emit-catalogs`**（无 Warning）。  
3. **映射**：在 **`pricing-catalog-sync-map.json`** 增加该工具所用的 **`catalogId` ↔ `modelKey` + `tierRaw` + `billingKind`**（与解析器、`findLine` 一致）。  
4. **运行镜像**：工具站 **scheme A catalog** 中该模型的成本列由 emit 回填；**禁止为改成本手改成本列**。  
5. **主站**：**`/admin/tool-apps/manage`** 新增 **`ToolBillablePrice`**（**`schemeARefModelKey`** 与工具站 **`modelId` / catalog id** 字符串一致）。

**B — 旧工具增加可售模型**：

1. **工具站可选中**：把模型加入对应 **`config/*-models.json`**（如分析室 **`visual-lab-analysis-models.json`**）及 **scheme A catalog**（如 **`visual-lab-analysis-scheme-a-catalog.json`** 的 `models[]` 中与 id 对齐的条）。  
2. **映射 + 价目**：对 **`TOKEN_IN_OUT`** 类须在 **`pricing-catalog-sync-map.json`** 增加一行并确保库内有对应 **`PricingSourceLine`**（import 后再 emit）。  
3. **主站**：为该 **`toolKey` + 新 `schemeARefModelKey`** 新增或编辑 **`ToolBillablePrice`**；若暂未完成 import，可 **手填成本（元）与 M** 先行保存，再补全价目以消除稽核偏差。

**C — 工具与模型的耦合度**：

- **数据结构上偏松**：无跨库外键，靠 **`catalogId` / `schemeARefModelKey` / `modelKey` / `tierRaw`** 等 **字符串约定** 对齐。  
- **运行与运营上偏紧**：任一层缺失会导致后台「参考成本」为空、工具站 **`billable-hint` 503**、或 SSO **\(M=2\)** 兜底与实标价不一致 —— **须按 A/B 一次性配齐**。

---

#### 附：历史（已废弃表，仅供读旧迁移 / 旧 PR 时对照）

- ~~迁移 **`20260618140000_tool_retail_multiplier_rule`**：`ToolRetailMultiplierRule`~~  
- ~~迁移 **`20260621120000_tool_scheme_a_model_retail_multiplier`**：`ToolSchemeAModelRetailMultiplier`~~  
- 上述表已由 **`20260625120000_drop_tool_scheme_a_retail_multiplier_tables`** 删除；**请勿在新代码中引用**。

### 5.5 AI 试衣 / 文生图 / 图生视频（方案 A）— 任务 JSON 与 **billingHint**

- **定价**：成本锚 **`tool-web/config/tools-scheme-a-catalog.json`**；零售 **× \(M\)**（§1、§5.4）。  
- **图生视频 settle 偶发 503（无法解析模型）**：DashScope 任务 JSON 若缺 `model` 字段，服务端已 **扩展解析路径**（`output` / `task_params` / 嵌套 `model` 键等）。若仍缺，**客户端可在 `POST /api/image-to-video/settle` body 中附带** `billingHint: { apiModel, durationSec?, resolution?, sr?, audio? }`；**时长与分辨率以任务 `usage` 为准**，`usage` 缺失时再用 hint 兜底。**不必等线上复现再改**：属防御性补强；**视频实验室** 在成功结算时已始终提交 `billingHint`。  
- **工程落点**：`tool-web/lib/image-to-video-task-billing.ts`（解析与合并）；`tool-web/app/api/image-to-video/settle/route.ts`。

### 5.6 上架与溯源（成本导入 + 工作单 · **已落地**）

本节约束 **「工具上架时如何定价才有依据」**；与 **§4**、**`learning-pricing-tool-onboarding-worksheet.md`** 一致。

#### 5.6.1 流程（必须）

1. **准则**：以 **`tool-web/doc/price.md`（中国内地）** 为对照官网的计算准则；变更保留 **Git diff**。  
2. **成本写入主站库（方案 A）**：在 **book-mall** 用 **`pnpm pricing:import-markdown`**（只替换 `TOKEN_IN_OUT`）或 **`pnpm pricing:import-csv`** / **Admin `POST /api/admin/pricing/import`**；首次环境 **`pnpm pricing:bootstrap`**。导入失败或需统一列格式时见 **§5.7**。  
3. **同步工具站 JSON**：库更新后执行 **`pnpm pricing:emit-catalogs`**（失败若有 **Warnings** 说明 `pricing-catalog-sync-map.json` 与库行不匹配，须先修复）。  
4. **可选稽核快照**：在 **tool-web** 执行 **`pnpm pricing:extract-price-md`**，更新 `config/generated/price-md-china-mainland-extract.json`，与 `price.md` **同一 PR**；**不替代** DB 真源。  
5. **查询单条**：`pnpm pricing:extract-price-md -- --lookup <模型关键词>`，将输出粘贴进工作单 **「成本导入记录」**（展示用；**权威以库 + emit 后 catalog 为准**）。  
6. **公式与过程**：按工作单 **§ 一** 填写 \(e_{in},e_{out},M\)，写出 **cost → retail → points** 三步。  
7. **主站标价行**：在 **`/admin/tool-apps/manage`** 维护 **`ToolBillablePrice`**：填 **`schemeAUnitCostYuan`**、**`schemeAAdminRetailMultiplier`**（\(M\)），由系统写入 **`pricePoints`**；**`schemeARefModelKey` / `toolKey` / `action`** 须与工具站请求 SSO 时一致（如试衣 **`fitting-room__ai-fit`** + **`try_on`**）。仅靠工作单「预估点数」仍须在后台 **落一行并保存**，避免运行时 **\(M=2\)** 兜底偏差。scheme A 目录 **成本列** 不得手改。PR 须附 **已填工作单** 或工单链接。  
8. **解析警告**：若 import 的 `warnings` 非空或 emit 报警，**停止依赖手填**，修复解析 / 映射 / 源文件后再导入。

#### 5.6.2 用户上传价目表（与 §5.7 一致）

- **CSV**：须符合 **`book-mall/lib/pricing/canonical-csv.ts`** 规范列；不符时用 **`pnpm pricing:normalize-upload-csv`** 转换后再 **`pnpm pricing:import-csv`** 或 Admin 上传。  
- **Markdown**：结构与 **`price.md`** 中国内地 Token 表一致时，可用 **`pnpm pricing:import-markdown`** 或 Admin **kind=markdown**；**非 Token 行** 仍保留库内上一版本。  
- **stub**：`lib/pricing/price-sheet-import-stub.ts` 仍可作为更复杂 Excel 映射的扩展位。

#### 5.6.3 工程文件索引

| 用途 | 路径 |
|------|------|
| 库表与迁移 | `book-mall/prisma/schema.prisma` · `PricingSourceVersion` / `PricingSourceLine` / `PricingLineChangeEvent` |
| `price.md` 中国内地 Token 表解析 | `book-mall/lib/pricing/price-md-china-parser.ts` |
| 规范 CSV 与 normalize | `book-mall/lib/pricing/canonical-csv.ts` · `pnpm pricing:normalize-upload-csv` |
| 导入合并 / bootstrap | `book-mall/lib/pricing/pricing-import-service.ts` · `scripts/pricing-*.ts` |
| 工具站 catalog 回填 | `book-mall/lib/pricing/emit-tool-web-catalogs.ts` · `pnpm pricing:emit-catalogs` |
| catalog ↔ 库映射 | **`tool-web/config/pricing-catalog-sync-map.json`** |
| Admin 上传 | **`book-mall/app/api/admin/pricing/import/route.ts`**（`ADMIN` + multipart `kind` + `file`） |
| **工具管理 · 按次单价（成本 × \(M\) → 点数）** | **`book-mall/app/admin/tool-apps/manage/page.tsx`** · `tool-billable-scheme-a-admin-cost.ts` · `admin-tool-billable-pricing.tsx` · `tool-billable-row-payloads.ts` |
| tool-web 侧 extract / lookup（稽核） | `tool-web/lib/pricing/*` · `pnpm pricing:extract-price-md` |
| 上架公式演示（纯函数） | `tool-web/lib/pricing/onboarding-math.ts` |
| 上传价目占位 | `tool-web/lib/pricing/price-sheet-import-stub.ts` |
| 生成物说明 | `tool-web/config/generated/README.md` |
| **工作单模板 + 示例** | **`tool-web/doc/product/learning-pricing-tool-onboarding-worksheet.md`** |

### 5.7 方案 A — 主站库为成本真源（命令与约束）

**工作目录均为 `book-mall`（除已注明外）**；数据库连接使用 **`.env.local`**。

| 步骤 | 命令 / 接口 | 说明 |
|------|-------------|------|
| 迁移 | `pnpm db:deploy` · `pnpm db:generate` | 应用含 `PricingSource*` 的迁移；新环境必须。 |
| 首次灌库 | `pnpm pricing:bootstrap` | 解析 **`../tool-web/doc/price.md`** 的 Token 行 + **`../tool-web/config/tools-scheme-a-catalog.json`** 非 Token 行；**仅当尚无 `isCurrent` 版本**。 |
| 仅更新 Token（常用） | 先更新 `tool-web/doc/price.md`，再 `pnpm pricing:import-markdown` | 替换库内所有 `TOKEN_IN_OUT`，**保留** 非 Token 行。 |
| 上传 CSV | `pnpm pricing:import-csv -- <path>` 或 **`POST /api/admin/pricing/import`** `kind=csv` | 须为规范列；失败时用 **`pnpm pricing:normalize-upload-csv -- in.csv out.csv`**。 |
| 上传 Markdown | **`POST /api/admin/pricing/import`** `kind=markdown` | 正文为与 `price.md` 同结构的 **中国内地** Token 表；逻辑同 `pricing:import-markdown`。 |
| 回写 tool-web | `pnpm pricing:emit-catalogs` | 读库 **`isCurrent`**，按 **`tool-web/config/pricing-catalog-sync-map.json`** 更新 **`visual-lab-analysis-scheme-a-catalog.json`** 与 **`tools-scheme-a-catalog.json`** 的**成本字段**；**有 Warnings 时脚本 exit 1**。 |

**约束摘要**：

- **不得**为调整成本而直接编辑 catalog 中的 **`inputYuanPerMillion` / `outputYuanPerMillion` / `costYuanPerOutputImage` / `costYuanPerImage` / `video.models.*`**：须改库再 **emit**。  
- **可调**且不必经过 emit 的示例字段：JSON 内 **`retailMultiplier`**（**仅当主站 SSO 不可用时的回退**；**生产环境的 \(M\) 以 `ToolBillablePrice` 为准**）、分析室默认/按模型的 **等价用量**、视频 JSON 结构中库未承载的展示字段（若与 `costJson.spec` 不一致，应改 **CSV/库** 再 emit）。  
- **新增分析室模型**：在 **`price.md`（或 CSV）** 有条目、`import` 进库后，还须编辑 **`pricing-catalog-sync-map.json`** 增加 `catalogId` ↔ `modelKey` + **`tierRaw`（与解析一致，如 `0<Token≤256K`、`无阶梯计价`）**，再 **emit**。

---

## 6. 实施阶段（建议）

| 阶段 | 内容 | 完成判据 |
|------|------|----------|
| P0 | 每条方案 A 工具在 **`ToolBillablePrice`** 有 **成本 + \(M\)**（常见 \(M=2.0\)）；列出 **当前已商用工具** 的 cost 与来源；调价 **只改编排行**（§5.4.5），不再维护全局系数表 | 清单评审通过 |
| P1 | 增加 `learning-pricing-catalog.json`（或等价）+ 类型校验（如 zod） | CI / 本地脚本校验通过 |
| P2 | 工具站关键页展示「约 X 元 / 次」等（与主站实际扣费一致） | 产品验收 |
| P3 | （可选）管理后台「从 catalog 生成建议定价」脚本或文档步骤 | 运营可独立更新 |

---

## 7. 扩展位（非首期必做）

- **阶梯 Token**：在 catalog 中增加 `tiers: [{ maxInputTokens, costIn, costOut }]`，引擎函数纯函数单测。  
- ** modifiers**：Batch 0.5、缓存折扣 —— 可作为 `multipliers` 挂条件键，学习端默认为 1。  
- **多地域**：复制本文档包，新增 `region` 维度与第二份 catalog。  

---

## 8. 复制到新平台 — 检查清单

复制 **本需求 + 本方案** 到新仓库后，逐项替换或确认：

- [ ] **已读 [§0 重大成果](./learning-pricing-solution.md#major-pricing-outcomes)**：模型单独计价、系统算成本、按模型 \(M\)（现网多为 2.0）  
- [ ] **零售系数 \(M\)**：是否在 **`ToolBillablePrice`**（工具管理 → 按次单价）**逐模型**维护；**勿**再依赖已删除的 `ToolRetailMultiplierRule` / `ToolSchemeAModelRetailMultiplier`（§5.4）  
- [ ] 地域策略（是否仍 **仅国内**）  
- [ ] 上游供应商与价目文档 URL  
- [ ] `toolKey` / 路由命名规范  
- [ ] 主站扣费表结构（`ToolUsageEvent` 等价物）  
- [ ] 币种与舍入规则  
- [ ] catalog 文件路径与 CI 校验命令  
- [ ] **上架**：新工具是否具备 **`learning-pricing-tool-onboarding-worksheet.md`** + `price.md` / extract **溯源**（§5.6）  

---

## 9. 修订记录

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| 0.1 | 2026-05-13 | 首版：公式、国内-only、catalog 策略、主站衔接、分期与迁移清单 |
| 0.2 | 2026-05-13 | 增加 §5.1 点数与 `balance_minor` 对齐，详阅 `learning-pricing-wallet-points.md` |
| 0.3 | 2026-05-13 | 指向开发前置必读 `learning-pricing-dev-prerequisites.md`（水位线、8000 点初值） |
| 0.4 | 2026-05-13 | §5.2：视觉实验室分析室方案 A（catalog、`costPoints`、主站旧行停用） |
| 0.5 | 2026-05-13 | §5.3：**实施结果**全文（price.md 与 catalog 关系、公式、1508 验算、工程落点、主站迁移名） |
| 0.6 | 2026-05-13 | §1 / §5：`ToolRetailMultiplierRule` + SSO 查询 + 工具站短缓存；§5.5：视频任务 JSON 解析扩展与 `billingHint`；文档结构整理（5.3.5→5.4→5.5） |
| 0.7 | 2026-05-14 | §4：成本须由 `price.md` extract / 未来上传导入；**§5.6** 上架溯源；`pnpm pricing:extract-price-md`；工作单 `learning-pricing-tool-onboarding-worksheet.md`；`lib/pricing/*` |
| 0.8 | 2026-05-13 | **方案 A（库为真源）**：主站 `PricingSourceLine`；`pricing:emit-catalogs` + `pricing-catalog-sync-map.json`；CSV 规范与 `normalize-upload-csv`；Admin `POST /api/admin/pricing/import`；§4 / §5.2 / §5.3.1 / §5.6–§5.7 修订 |
| 0.9 | 2026-05-14 | **§5.2 / §5.6.1 / §5.6.3 / §5.7 / §6 / §8** 同步 §5.4：**\(M\)** 仅以 **`ToolBillablePrice` + SSO** 为准；删全局/按模型系数表说明一致化；§5.4.4 增补 **book-mall 独部署与 `../tool-web` 路径** |
| 1.0 | 2026-05-14 | **§5.4.6**：新工具/新模型**不自动入池**、旧工具加模型可选路径、松/紧耦合说明；主站按次单价 UI：**建议浮层 + 手填参考模型**与价目缺失提示 |
| 1.1 | 2026-05-14 | **§5.4.1**：**已有 `ToolBillablePrice` 行** 仅可改 **`effectiveTo`**；调价须新增行；`updateToolBillablePrice` 仅持久化生效止 |
| 1.2 | 2026-05-14 | **§5.4.1**：已有行 **仅当 `effectiveTo` 为空时可填一次**结束时间；已设结束时间后 UI 只读 + 服务端拒绝更新 |
| **2.0** | **2026-05-14** | **§0（新增）**：**重大成果**声明——**模型单独计价**、**成本系统计算**、**\(M\) 按模型自定**；**当前 \(M\) 多为 2.0** 但语义按行可配；**开发工具/计费前必读** |
| 2.1 | 2026-05-14 | **§0.4**：**与当前实现结论（对照）**表——口号与代码/数据语义逐项核对；「都是 2.0」= 常见配置非硬编码；稽核需查库 |
| 2.2 | 2026-05-14 | **§0.5**：仓库核查——迁移/seed **未**批量写入 `schemeAAdminRetailMultiplier=2`；列可为 **NULL**；「多为 2.0」**不可替代**环境内 SQL 统计 |
