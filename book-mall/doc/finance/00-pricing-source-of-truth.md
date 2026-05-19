# 财务总宪：价格唯一基线 / 公式 / 数据源 / 偏差登记

> **TL;DR**
> 我方对用户单价 = **云厂商挂牌价（成本价）× M（当前 = 2）**。
> 云厂商挂牌价的唯一基线是 [`tool-web/doc/price_0518.md`](../../../tool-web/doc/price_0518.md)。
> 任何与此基线不一致的扣费都是 **bug**，必须在本文档登记并修复。

本文档建立 2026-05-18，源自当天发现的 happyhorse 1080P 视频"挂牌 ¥8 / 实扣 ¥45"的过度扣费事件。

---

## 一、唯一基线（Single Source of Truth）

| 项 | 内容 |
| --- | --- |
| **基线文件** | `tool-web/doc/price_0518.md` |
| **价格口径** | 云厂商**挂牌价**（不计任何商务折扣 / 优惠券 / 阶梯返点） |
| **币种** | 人民币（含税口径与挂牌一致） |
| **区域** | 中国内地 |
| **生效日** | 文件 frontmatter 标注；最新一次校对：2026-05-18 |

**禁止**在 `price_0518.md` 之外任何地方"暗中"维护成本价（catalog C / D 表 / scripts / 文档示例都必须能反查到 price_0518.md 中对应行）。

> 之前的过度扣费正是因为 D 表的 `schemeAUnitCostYuan` 被人手填成了 4.5 元/秒（实际挂牌只有 0.9 / 1.6），且没有任何反查机制。

---

## 二、定价公式

```
我方单价 = 云厂商挂牌价（成本价） × M
M（retailMultiplier） = 2（约定；管理后台未来可分模型/分行调）
1 点 = ¥0.01
pricePoints = round(我方单价 × 100)
```

**计费维度（与挂牌单位严格一致）**：

| billingKind | 用量单位 | 实扣公式 |
| --- | --- | --- |
| `VIDEO_MODEL_SPEC` | 秒（按云厂商 output usage 取整 ceil） | `cost × max(minBilledVideoSec, ⌈durationSec⌉) × M` |
| `OUTPUT_IMAGE` / `COST_PER_IMAGE` | 张（按 settle 上报 imageCount） | `cost × max(minBilledImageCount, imageCount) × M` |
| `TOKEN_IN_OUT` | 次（每次固定 `pricePoints`） | `pricePoints`（每次固定，不按 token 用量动态算；见 §五） |

**最低/最高扣费线**（`PlatformConfig.default`）：

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `minBilledVideoSec` | 5 | 视频按秒计费时，不足 5 秒按 5 秒兜底 |
| `minBilledImageCount` | 1 | 图片按张计费时，不足 1 张按 1 张 |
| `minChargePointsPerInvoke` | 1 | 单次调用最低 1 点（避免 0 点） |
| `walletHoldDefaultTtlMin` | 10 | WalletHold 默认 TTL（v005 从 30 → 10） |
| `minBalanceLinePoints` | 2000 | 工具准入余额线（¥20） |

不设置"最高扣费线"——任何上限改由 `WalletHold` 的 1.2× 安全系数 + reserve / settle 双段实现（见 §六）。

---

## 三、四级数据源（B / C / D / R）与角色

| 标签 | 文件 / 表 | 角色 | 谁来维护 |
| --- | --- | --- | --- |
| **B** | `tool-web/doc/price_0518.md` | 唯一基线（云厂商挂牌价） | 云厂商更新 → 人工同步本仓库 |
| **C** | `tool-web/config/tools-scheme-a-catalog.json` | 工具站本地估算（前端展示 + reserve hold 估算） | `pricing:emit-catalogs` 同步 / 人工 |
| **D** | `ToolBillablePrice`（数据库表） | **真扣点的唯一来源**（settle 时按行查） | `pricing-realign-from-price-md` 脚本写库 |
| **R** | `ToolBillingDetailLine.cloudRow.snapshot`（每条扣费记录里的 cost / M / pricePoints 快照） | 历史快照（用户对账依据） | `recordToolUsageAndConsumeWallet` 自动写入 |

**约束**：

- D 表的 `schemeAUnitCostYuan` 必须 **= B（即 price_0518.md）的挂牌价**；偏离即视为 bug。
- C 的单价（每模型 / 每档位）必须 **≥ D 的对应单价**；否则 reserve 阶段锁的钱小于 settle 实扣 → 出现"先用后欠"的财务漏洞。
- D 的 retailMultiplier 必须 = 2（本文档约定）；如有任何模型需要个性化，需在管理界面调，并在本文档"已知偏差"登记。

**每次价格变更的标准流程**：

1. 更新 `price_0518.md`（B）。
2. 跑 `pnpm pricing:realign-from-md`（dry）→ 确认 diff 与预期一致。
3. 跑 `pnpm pricing:realign-from-md:apply`。
4. 跑 `pnpm pricing:inspect-billable-vs-md`，确保返回 `✅ 全部对齐`。
5. 同步更新 `tool-web/config/tools-scheme-a-catalog.json`（C），保证 C 单价 ≥ D。
6. 记录到当期发布文档（`book-mall/doc/releases/`）。

---

## 四、ToolBillablePrice (D) 行的颗粒度

**约定**：每个 `(toolKey, action, schemeARefModelKey, cloudTierRaw)` 组合一行。

`cloudTierRaw` 命名规范：

| 模型类 | tierRaw 示例 |
| --- | --- |
| 视频 / 普通分辨率 | `"720P"` / `"1080P"` / `"480P"` / `"360P"` |
| 视频 / wan2.6-flash 这类按音频细分 | `"720P\|audio"` / `"720P\|silent"` / `"1080P\|audio"` / `"1080P\|silent"` |
| 图片（按张） | `""`（空） |
| Token | `"无阶梯计价"` / `"0<Token≤32K"` / `"0<Token≤128K"` / `"0<Token≤256K"` 等（与 PricingSourceLine.tierRaw 同步） |

读侧（`resolveBillableSnapshot`）按 `videoTierCandidates(actuals.videoSr, actuals.videoAudio)` 顺序选行：例如 `sr=1080, audio=true` 优先匹配 `"1080P|audio"`，没命中再 fallback `"1080P"`。

---

## 五、Token / 视觉分析（`visual-lab__analysis`）的折中口径

挂牌价是 input + output 双价，但 D 表 `schemeAUnitCostYuan` 只能存一个数。当前折中：

- `cost = (input + output) / 2`（元 / 百万 token，对内单一指标）
- `pricePoints = round(cost × M × 100)`
- **每次调用固定扣 `pricePoints` 点，不按真实 token 用量动态算**

这意味着 token 类工具的扣费颗粒度**比按秒/按张大**：用户问一句简短的话和一句长的话扣同样多。这是产品取舍（避免每次扣点波动），不是 bug。如未来要按真实 token 计费，需要：

1. schema 拆字段 `inputUnitYuan` / `outputUnitYuan`；
2. settle path 真实读 `inputTokens` / `outputTokens` → 算 yuan → 算 points；
3. 同步改 catalog C 的 reserve 估算。

---

## 六、WalletHold（钱包预占用）解锁机制

### 状态机

```
HELD ──── reserveWalletHold（start 阶段，乐观扣 1.2× 估算）
  │
  ├── settle (success) ──→ SETTLED      （写 ToolBillingDetailLine + WalletPointsLedger）
  ├── settle (failure) ──→ RELEASED     （任务失败显式释放）
  ├── expiresAt 已过 ───→ EXPIRED      （cron 或下一次 reserve 顺手清理）
```

### TTL 与释放渠道

- 默认 TTL：**10 分钟**（v005 从 30 → 10；视频任务实际 < 5 min 占 95%）。
- 释放路径：
  - 失败显式释放（i2v / r2v / t2v 创建失败）：`releaseWalletHoldFromServer`。
  - 主动 cron：`/api/admin/wallet-holds/expire`，每 5 分钟跑一次（`book-mall/vercel.json`）。
  - 机会主义清理：每次 `reserveWalletHold` 也会扫一轮过期 hold。
  - 兜底脚本：非 Vercel 部署用 `pnpm wallet-holds:expire`（systemd timer / cron）。

### 安全系数

```
reservedPoints = ceil(estimatedMaxPoints × SAFETY_MARGIN)   SAFETY_MARGIN = 1.2
```

settle 实扣 ≤ reservedPoints，差额自动归还到余额（`WalletPointsLedger`）。

---

## 七、已知偏差登记

> **格式**：`YYYY-MM-DD · 偏差描述 · 影响 · 状态`

### 2026-05-18

- ✅ **D 表视频模型 cost 与挂牌严重不符**：happyhorse 系列 D 表填 4.5 元/秒（应 720P 0.9 / 1080P 1.6），导致 1080P 5 秒扣 ¥45 而非 ¥16。
  - 状态：已修复（`pricing-realign-from-price-md.ts --apply` 重生成全部 50 行视频价目）。
- ✅ **D 表无 cloudTierRaw 区分档位**：所有视频模型只有单行 + tier="`"，720P / 1080P 走同一价。
  - 状态：已修复（D 表按档位拆行 + `resolveBillableSnapshot` 按 sr 选行）。
- ✅ **catalog C 的 happyhorse 走 `flatYuanPerSecond: 0.9`**：1080P 调用 reserve 时只锁 0.9×duration×2，少于 settle 实扣（1.6×duration×2）。
  - 状态：已修复（C 改 bySr）。
- ⚠️ **wan2.6-flash audio 维度的 hold reserve**：D 已按 audio/silent 拆 4 行，C 也按 bySrAudio 拆，但 reserve 阶段 catalog C 路径不传 audio 参数（默认按 audio:true 估算）。
  - 状态：可接受（保守锁高价，settle 时按真实 audio 退差额）。
- ℹ️ **视觉分析（千问）按次固定扣点**：与"按 token × 挂牌"不一致，但是产品决定，已在 §五 说明。

### 历史

- 2026-05-16 · 引入按秒计费 + WalletHold 机制。详见 `book-mall/doc/releases/2026-05-16-per-second-billing-and-model-calibration.md`。

---

## 八、对账 / 审计流程

### 周期性

- `pnpm pricing:inspect-billable-vs-md`（每次发布前 / 价格变更后必跑）：D vs B 全量比对，期望 `✅ 全部对齐` 否则非 0 退出。
- `pnpm pricing:audit-billable-vs-source`：D 与 PricingSourceLine 的内嵌一致性检查。

### 用户报问题时

1. 拿到具体调用 `eventId` / `billDetailLineId`。
2. 在 `ToolBillingDetailLine` 看 `cloudRow` 字段（结构化快照）：cost / M / pricePoints / cloudTierRaw / vendorCommodityCode 全在。
3. 同步看云厂商账单（`PricingSourceLine` 当时版本 / 厂商 CSV），三方对得上。
4. 如对不上 → 在 §七 登记，发版修。

---

## 九、相关文件指南

| 文件 / 路径 | 作用 |
| --- | --- |
| `tool-web/doc/price_0518.md` | **B**：唯一基线 |
| `tool-web/config/tools-scheme-a-catalog.json` | **C**：reserve / 前端估算 |
| `book-mall/lib/tool-billable-price.ts` | **D 读侧**：`resolveBillableSnapshot` |
| `book-mall/scripts/pricing-realign-from-price-md.ts` | **D 写侧**：批量整齐脚本 |
| `book-mall/scripts/inspect-billable-vs-price-md.ts` | 长期 audit 工具 |
| `book-mall/lib/wallet-holds.ts` | reserve / release / expire |
| `book-mall/app/api/admin/wallet-holds/expire/route.ts` | cron endpoint |
| `book-mall/app/(site)/pricing-disclosure/page.tsx` | 前台公示 |
| `book-mall/app/(account)/account/pricing/page.tsx` | 个人中心价目 |
| `book-mall/app/admin/finance/cloud-pricing/page.tsx` | 管理端在库价目 |
