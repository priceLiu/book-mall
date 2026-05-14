# 学习端 · 计费、水位线与视觉实验室 — 开发前置说明

> **强制性约定**：在 **tool-web / book-mall** 内开发 **计费、扣费、钱包门槛、视觉实验室（分析室）相关功能** 前，**须通读本篇及下方引用文档**。  
> **首先**通读 **[learning-pricing-solution.md §0](./learning-pricing-solution.md#major-pricing-outcomes)**（重大成果：**模型单独计价**、**成本系统计算**、**系数 \(M\) 按模型自定**；**当前 \(M\) 多为 2.0**）。  
> 本文记录 **已讨论一致的产品结论** 与 **推荐技术实施方案**，避免实现与「学习端轻量报价」体系冲突。

---

## 1. 必读引用（按顺序）

| 顺序 | 文档 | 用途 |
|------|------|------|
| **0** | [learning-pricing-solution.md §0](./learning-pricing-solution.md#major-pricing-outcomes) | **重大成果（必读）**：单独计价、系统算成本、按模型 \(M\)；默认 2.0 语义 |
| 1 | [learning-pricing-requirements.md](./learning-pricing-requirements.md) | 需求基线：国内 only、无免费额度对客、修订跟踪 |
| 2 | [learning-pricing-solution.md](./learning-pricing-solution.md)（全文） | 公式、catalog 落地、主站衔接、§5 实施细节、分期 P0～P3 |
| 3 | [learning-pricing-wallet-points.md](./learning-pricing-wallet-points.md) | **1 点 = 1 分**，与 `Wallet.balanceMinor` / 扣费一致 |
| 4 | [billing-plan-rules.md](./billing-plan-rules.md) | 全站计费免责与产品口径 |

价目快照（**非运行时代码唯一源**）：[`../price.md`](../price.md) — 结构化配置以 **catalog** 为准。

---

## 2. 已对齐的产品结论（摘要）

### 2.1 报价与范围

- **零售价系数 \(M\)**：**按模型（按 `ToolBillablePrice` 行）配置**，字段 **`schemeAAdminRetailMultiplier`**；SSO 按 **`toolKey` + `modelKey`** 命中该行。**当前各模型多为 `2.0`**，与历史「成本 × 2」口径一致，但 **非全站写死常量**——差异化时只改对应行（详见 **solution §0**）。  
- **价目来源**：以 **阿里云百炼中国内地** 价为成本锚；**成本主线由系统按价目库 + sync map + emit 计算/预填**；`price.md` 为人工快照备查。  
- **免费额度**：**不对客承诺**百炼免费即本产品权益；**全收费**路径下不在逻辑上依赖免费额度抵扣用户应付。  
- **实施顺序**：**先做视觉实验室（分析室）**，试衣间、文生图、图生_video 等 **后续再对齐**，不要求一期全站换血。

### 2.2 计费形态（分析室首期）

- **方案 A（catalog + 等价 Token）**：真源 `config/visual-lab-analysis-scheme-a-catalog.json`；对每个 `modelId` 用中国内地首档元/百万 Token 与约定等价用量折算 **单次成本（元）**，再 **× 该模型在 `ToolBillablePrice` 上的 \(M\)**（**现网多为 `2.0`**）得零售，**`max(1, round(零售元 × 100))` → 扣费点数**。  
- **与主站**：工具站在 **`POST /api/sso/tools/usage`** 传入服务端计算的 **`costPoints`**；主站历史「分析室 invoke 一口价」`ToolBillablePrice` 行已 **停用**，避免与按模型价冲突。  
- **对外说明与验算**：产品/客服/研发统一口径见 **`learning-pricing-solution.md` §5.3（实施结果）**（含与 `price.md` 关系、1508 点示例、代码路径与迁移名）。  
- **深度思考**：须 **单独可识别的扣费档位**（加价或独立 `action`/价目行），打开前 **提示余额门槛 / 需充值**；扣费前 **`requiredPoints` 必须确定**。

### 2.3 扣费明细（产品期望）

- 用户侧：**关键扣费可解释**（模型、规则名、等价假设、幂等 `taskId`/请求 id、扣费前后余额若接口提供）。  
- 稽核侧：**`ToolUsageEvent.meta`（JSON）** 建议写入结构化字段（`modelId`、`scheme`、`officialIn/Out`、`multiplier`、`retailPoints`、`catalogRef` 等），便于客服与对账。

---

## 3. 不能有负余额（技术硬约束）

- 主站扣费须 **事务内** **`balancePoints >= 本次扣减`**，不足则 **402**、**不写流水、不减余额**。  
- **不在学习端首期**引入「授信透支」；若未来支持代扣，须 **独立需求** 与 **独立协议**，不得与本篇默认混用。

---

## 4. 可控额度 / 保留水位（产品软约束 + 可配置）

### 4.1 意图

- 类似常见 AI 产品：**额度可控**，接近「底线」时 **拦截或强提示**，避免用户误操作把余额榨到难以续用、降低客诉与运营风险。  
- **具体数字不锁死**：运营可在 **主站后台** 调整；实现上须 **读配置**，禁止写死魔法数（除 **文档给出的推荐初值** 外）。

### 4.2 推荐两层校验（同时存在）

| 层级 | 含义 | 说明 |
|------|------|------|
| **单笔足额** | `balancePoints >= requiredPoints` | **单笔请求前**必须满足；`requiredPoints` 由当前模型 + 是否深度思考等决定。 |
| **保留水位（可选加强）** | `balancePoints >= requiredPoints + reservePoints` | **发起扣费前**保证扣完后仍不低于 **`reservePoints`**，或等价地要求 **扣前余额 ≥ 本笔费用 + 保留额**（具体实现选一种语义写进代码注释，团队统一）。 |

**说明**：若仅做「单笔足额」不做保留额，可能出现「扣完只剩几十点」仍可多次点低价接口；若产品希望 **始终留一截安全垫**，必须启用 **保留水位**。

### 4.3 与主站配置的映射

- 主站已有 **`PlatformConfig.minBalanceLinePoints`**（默认 2000 = 约 ¥20），历史上偏「全站最低线」语义。  
- **实现阶段**可选：  
  - **短期**：将「保留水位」**先落在此字段**（运营改为推荐初值，见 §5）；或  
  - **中期**：拆分专用字段（如 `toolWalletReservePoints`）与「纯展示用最低线」分离，避免语义混淆。  
- **工具站**：从 **`introspect` / 钱包 API** 读取与门槛相关的配置（若当前无字段，由 book-mall 扩展只读接口），**禁止**在 tool-web 私设第二套门槛常量作为唯一依据。

---

## 5. 保留水位 — 推荐初始配置值（运维可先写入后台）

在 **catalog 尚未算出全模型 `MAX_SINGLE_CHARGE_POINTS` 之前**，需要一个 **可上线的保守默认**，避免默认 2000 点与「单次可能数十～近百元」认知脱节。

| 项目 | 建议 |
|------|------|
| **推荐初始 `reservePoints`（或过渡期 `minBalanceLinePoints`）** | **8000 点**（约 **¥80**，在 **1 点 = 1 分** 前提下） |
| **选取理由** | 高于历史默认 ¥20 线；介于你们讨论的 ¥50～¥100 区间中位偏上；为「高价模型单次扣费 + 少量缓冲」留空间；具体仍 **以后台配置为准**。 |
| **catalog 上线后复核公式（建议写进运营手册）** | `effectiveReserve = max(8000, ceil(1.2 × MAX_SINGLE_CHARGE_POINTS))`，按季度或改价时重算。 |

**区间说明**（供运维调参，非代码写死）：

- 偏激进：`5000` 点（~¥50）  
- **推荐起点**：`8000` 点（~¥80）  
- 偏保守（高价模型为主）：`12000`～`15000` 点（~120～150 元）

---

## 6. 开发检查清单（合并实现前自证）

- [ ] 已读 **[solution §0](./learning-pricing-solution.md#major-pricing-outcomes)**（重大成果：单独计价、系统成本、按模型 \(M\)）  
- [ ] 已读本篇 §1 引用文档  
- [ ] 扣费路径：**先主站成功扣费，再调上游**（分析室已按此原则）  
- [ ] **`requiredPoints` 仅服务端计算**；浏览器只展示  
- [ ] 单笔校验 + （若做）**保留水位** 与 **PlatformConfig** 一致  
- [ ] 深度思考：**加价或独立价目** + **开通前提示**  
- [ ] **`ToolUsageEvent.meta` 可审计**（至少实验室首期建议具备）  
- [ ] 改价 / 改系数走 **需求文档 §7 修订表**  

---

## 7. 修订与跟踪

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| 0.1 | 2026-05-13 | 首版：开发必读、讨论结论、双层校验、推荐初始保留 **8000 点**、与 `minBalanceLinePoints`/后续字段关系 |
| 0.2 | 2026-05-13 | §2.2：方案 A 已落地；指针 **`learning-pricing-solution.md` §5.3**（实施结果与验算） |
| 0.3 | 2026-05-14 | **§0 链接**：必读表增「顺序 0」→ solution **重大成果**；§2.1/2.2 改为 **按模型 \(M\)**（现网多为 2.0）；§6 自检增 §0 |

---

*路径：`tool-web/doc/product/learning-pricing-dev-prerequisites.md`*
