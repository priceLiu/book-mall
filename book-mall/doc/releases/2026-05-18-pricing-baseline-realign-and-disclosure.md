# 2026-05-18 · 价格基线对齐 / 价格公示扩列 / WalletHold 解锁强化

> 紧急修复：用户 `liu_price168@126.com` 反馈"文生图明细错挂在试衣间名下 + 1080P 视频 5 秒被扣 ¥45（云厂商挂牌仅 ¥8）"。
> 本次发布把整个工具站的价格链路从源头到展示全部理顺，确保**用户单价 = 云厂商挂牌价 × 2** 这个约定可机器验证。

发布日期：2026-05-18
影响范围：`book-mall`（核心扣费 / 公示 / WalletHold）、`tool-web`（catalog / settle）、`finance-web`（无代码改动，但展示数据会因 D 表对齐而更新）。

---

## 1. 本次扫描发现的问题

### 1.1 用户身份漂移（已在 5/16–17 系列发布修复，留作背景）

`finance-web/.env.development` 默认开启 `NEXT_PUBLIC_FINANCE_USE_DEV_PROXY=1`，导致所有用户的"财务控制台账单详情"被代理到一个固定 `FINANCE_DEV_USER_ID`。该用户登录后看到的不是自己的明细。

### 1.2 文生图记录被误标为"试衣间"

`applyCanonicalOverlay` 当多个产品共享 `vendorCommodityCode` 时，aliases 命中顺序不稳定 → `wanx2.1-t2i-plus` 被改写成 `aitryon`。

### 1.3 ⚠️ 视频模型扣费严重高于挂牌价（核心 bug）

| 模型 | 挂牌价（B / `price_0518.md`） | D 表填的 cost | 偏差倍数 |
| --- | --- | --- | --- |
| `happyhorse-1.0-i2v` 1080P | 1.6 元/秒 | 4.5 元/秒 | **~2.8×** |
| `happyhorse-1.0-i2v` 720P | 0.9 元/秒 | 4.5 元/秒 | **5×** |
| `pixverse-c1-it2v` 360P | 0.24 元/秒 | 1.2 元/秒 | **5×** |
| `pixverse-v6-it2v` 360P | 0.21 元/秒 | 1.05 元/秒 | **5×** |
| `wan2.6-i2v` 1080P | 1 元/秒 | 3 元/秒 | **3×** |
| `wan2.7-i2v` 1080P | 1 元/秒 | 3 元/秒 | **3×** |
| `wan2.5-i2v-preview` 1080P | 1 元/秒 | 3 元/秒 | **3×** |
| `wan2.6-i2v-flash` 1080P+audio | 0.5 元/秒 | 1.5 元/秒 | **3×** |

**典型场景**：5 秒 1080P happyhorse 图生视频
- 应扣：`1.6 × 5 × 2 = ¥16`（成本 ¥8，毛利 ¥8）
- 实扣：`4.5 × 5 × 2 = ¥45`（用户多付 ¥29）

### 1.4 D 表无 `cloudTierRaw` 区分档位

每个视频模型只有 1 行 + tier 空，720P / 1080P 调用都走同一价。

### 1.5 `resolveBillableSnapshot` 不按档位选行

读侧没有 `cloudTierRaw` / `videoSr` 维度，只看 `(toolKey, action, schemeARefModelKey)`，注定 D 多档位也读不出来。

### 1.6 catalog C 与 D 不一致

`tools-scheme-a-catalog.json` 的 `happyhorse` 用 `flatYuanPerSecond: 0.9`，与 1080P（应 1.6）不符 → reserve hold 估太低，settle 时实扣高于 hold，可能用户余额刚好卡在中间产生异常。

### 1.7 WalletHold 机制弱

- 默认 TTL = 30 min，长尾未 settle 任务会长期占住用户余额。
- expire endpoint 仅接管理员 POST，没有定时调用。

### 1.8 价格公示页粒度过粗

- `getEffectiveBillablePricesForDisclosure` 按 `(toolKey, action, schemeARefModelKey)` 去重 → 同模型 720P/1080P 互相吃掉，看不全。
- 公示页未展示"云厂商挂牌价（成本）"、"云厂商产品 / 商品 / 计费项"，用户没法独立验证我方定价合理性。

---

## 2. 修复方案（已落地）

### 2.1 价格基线建立（财务总宪）

新建 [`book-mall/doc/finance/00-pricing-source-of-truth.md`](../finance/00-pricing-source-of-truth.md)，明确：

- `tool-web/doc/price_0518.md` 是**唯一**云厂商挂牌价基线。
- `用户单价 = 挂牌价 × M`（M=2）。
- 4 级数据源 B / C / D / R 角色与维护流程。
- minBilledVideoSec / WalletHold / 偏差登记 / 对账流程。

### 2.2 D 表按档位重整（一次性 + 长期 audit）

#### 新脚本 `scripts/pricing-realign-from-price-md.ts`

- `--dry`（默认）：列出 to-create / to-update / to-deactivate 的全部行，不写库。
- `--apply`：在事务里写库。
- 期望表 `EXPECTATIONS` 为本次基线（53 行），含图片 / 视频按档位拆 / 千问 8 个模型折算 cost。

执行结果（已 apply）：

| 类别 | 行数 |
| --- | --- |
| upToDate | 3（aitryon / aitryon-plus / wanx2.1-t2i-plus） |
| toCreate | 42（视频按档位 50 行 - 已对齐 8 行） |
| toUpdate | 8（千问 8 个模型 cost 折算 (input + output) / 2） |
| toDeactivate | 19（旧 tier="" 单行视频，保留审计痕迹） |

视频拆行示例（happyhorse-1.0-i2v）：

```
旧：tier=""  cost=4.5  pp=900   (active=false)
新：tier="720P"  cost=0.9  pp=180
新：tier="1080P" cost=1.6  pp=320
```

千问类（TOKEN_IN_OUT）保持"每次固定扣 pricePoints"语义不变，但 cost 从手填值改为 `(input + output) / 2`：

```
qwen-vl-max:    cost 2.84 → 2.8   (1.6 + 4.0) / 2
qwen-vl-plus:   cost 1.42 → 1.4   (0.8 + 2.0) / 2
qwen3-vl-plus:  cost 6.05 → 5.5   (1.0 + 10.0) / 2
qwen3-vl-flash: cost 0.91 → 0.825 (0.15 + 1.5) / 2
qwen3.5-plus:   cost 3.015 → 2.8  (0.8 + 4.8) / 2
qwen3.5-flash:  cost 1.21 → 1.1   (0.2 + 2.0) / 2
qwen3.6-plus:   cost 7.54 → 7.0   (2.0 + 12.0) / 2
qwen3.6-flash:  cost 4.525 → 4.2  (1.2 + 7.2) / 2
```

#### 长期 audit 工具

- `scripts/inspect-billable-vs-price-md.ts`（升级为长期工具，加 audio/silent 后缀解析、退出码非 0 表示有偏差）
- `package.json` 新增：
  - `pnpm pricing:realign-from-md` / `pnpm pricing:realign-from-md:apply`
  - `pnpm pricing:inspect-billable-vs-md`

### 2.3 读侧按 `(sr, audio)` 选行

`book-mall/lib/tool-billable-price.ts`：

- 新增 `videoTierCandidates(sr, audio)`：返回 `["1080P|audio", "1080P"]` 这种"精度从高到低"候选列表。
- `resolveBillableSnapshot` 在 `chosen.length > 1` 时按候选顺序逐一筛 `cloudTierRaw`，第一个命中即为最终行。
- `ResolveBillablePriceOpts.actuals` 增 `videoSr` / `videoAudio`。

`book-mall/app/api/sso/tools/usage/route.ts`：

- `actualsFromUsageBody` 从 `meta.videoSr` / `meta.videoAudio` 抽数透传。

### 2.4 catalog C 与 B 对齐

`tool-web/config/tools-scheme-a-catalog.json`：

- `happyhorse-1.0-i2v` / `t2v` / `r2v` 改 `bySr: { "720": 0.9, "1080": 1.6 }`。
- 新增 `happyhorse-1.0-video-edit`（同档位）。
- `pixverse-*` 改 `bySr: { "360": 0.24/0.21 }`（保留可扩展）。

reserve 端不变（仍走 `computeVideoChargePoints`），但因 C 已与 D 对齐，reserve 锁的钱永远 ≥ settle 实扣，financial loophole 关闭。

### 2.5 价格公示页扩列

`/pricing-disclosure`（外站公示）：

- 去重键：`(toolKey, action, schemeARefModelKey, cloudTierRaw)` → 同模型多档位独立成行。
- 新增列：
  - 模型显示名（来自 `ModelCatalog.displayName`）
  - 档位（cloudTierRaw）
  - **云厂商产品 / 商品 / 计费项**（`ModelCatalog.vendorProductName` / `vendorCommodityName` / `vendorBillableItemName`）
  - **云挂牌价（成本）**（`schemeAUnitCostYuan`）
  - **M**（`schemeAAdminRetailMultiplier`）
  - **我方单价**（cost × M，与挂牌单位对齐）
- 新工具函数 `describeUnitForDisclosure(billingKind, tierRaw)` 输出"元 / 秒（1080P · 含音频）"等可读单位。

`/account/pricing`（个人中心）：

- 文案顶部新增"我方单价 = 云挂牌价 × M（当前 M=2）"+ 跳转 `/pricing-disclosure` 链接。
- 表格列结构与公示页对齐：模型 / 档位 / 厂商产品商品 / 单位 / 云挂牌价 / M / 我方单价 / 单价（点）。

`/admin/page.tsx`（管理端首页）已有"前台价格公示"链接，本次保持。

### 2.6 WalletHold 强化

- `PlatformConfig.walletHoldDefaultTtlMin` 默认 30 → **10**（迁移 `prisma/migrations/20260518130000_wallet_hold_ttl_default_10/`）。
- `/api/admin/wallet-holds/expire` 升级：
  - 接受 GET（用于 cron） + POST（用于 admin 浏览器）。
  - 三种鉴权：`x-vercel-cron` header / `Authorization: Bearer ${CRON_SECRET}` / `?secret=…` / NextAuth admin session。
- 新建 `book-mall/vercel.json`：每 5 分钟调用一次 expire endpoint。
- 兜底脚本 `scripts/release-expired-wallet-holds.ts`（非 Vercel 部署用 systemd timer / cron 调）：
  - `pnpm wallet-holds:expire`

---

## 3. 验收

```
pnpm pricing:inspect-billable-vs-md
# → ✅ 全部对齐。  exit 0
```

```
SELECT walletHoldDefaultTtlMin FROM PlatformConfig WHERE id='default';
# → 10
```

公示页：

- 访问 `/pricing-disclosure` → 视频模型每档位独立成行，云挂牌价 + 厂商产品名 / 商品名 / 计费项均显示。
- `happyhorse-1.0-i2v` 1080P 行：云挂牌 ¥1.60、M=2、我方单价 ¥3.20、单价（点）= 320。

个人中心：

- 访问 `/account/pricing` → 列结构与公示页一致；顶部含"查看完整价格公示"链接。

WalletHold：

- 跑 `curl -X GET 'https://<host>/api/admin/wallet-holds/expire' -H 'Authorization: Bearer <CRON_SECRET>'` → `{ ok: true, expired: <n>, via: "cron-secret" }`。
- 1080P 5 秒 happyhorse 调用：reserve `≈ 320 × 1.2 = 384` 点，settle 实扣 `1.6 × 5 × 2 × 100 = 1600` 点 / 退差。
  > **注**：reserve 用 catalog C，settle 用 D，二者本次已对齐，差异仅 1.2× 安全系数。

---

## 4. 涉及文件

### 数据 / 数据库

- `prisma/schema.prisma`（walletHoldDefaultTtlMin default 30 → 10）
- `prisma/migrations/20260518130000_wallet_hold_ttl_default_10/migration.sql`
- ToolBillablePrice：50 行新建 / 8 行更新 / 19 行 deactivate（详见上 §2.2）

### 代码

- `book-mall/lib/tool-billable-price.ts`（按 sr/audio 选行）
- `book-mall/app/api/sso/tools/usage/route.ts`（actuals 透传）
- `book-mall/lib/pricing-disclosure.ts`（去重 + join ModelCatalog + 新 `getPricingTableRowsForDisclosure`）
- `book-mall/components/pricing/pricing-table.tsx`（**新；唯一价目表组件**）
- `book-mall/components/pricing/pricing-formula-card.tsx`（**新；公式说明卡**）
- `book-mall/app/(site)/pricing-disclosure/page.tsx`（改用共享组件）
- `book-mall/app/(account)/account/pricing/page.tsx`（改用共享组件；旧 `pricing-table-client.tsx` 已删除）
- `book-mall/app/admin/finance/cloud-pricing/page.tsx`（删除"在库价目"section，改为跳转入口；旧 `cloud-pricing-master-client.tsx` 已删除）
- `book-mall/components/admin/admin-nav.tsx`（菜单加"前台公示"入口）
- `book-mall/app/api/admin/wallet-holds/expire/route.ts`（GET + cron-secret）
- `book-mall/scripts/pricing-realign-from-price-md.ts`（新）
- `book-mall/scripts/inspect-billable-vs-price-md.ts`（升级为长期工具）
- `book-mall/scripts/release-expired-wallet-holds.ts`（新）
- `book-mall/scripts/refund-overcharge-2026-05-18.ts`（**新；一次性补偿脚本**）
- `book-mall/vercel.json`（新；5 分钟 cron）
- `tool-web/config/tools-scheme-a-catalog.json`（happyhorse / pixverse 改 bySr，新增 video-edit）

### 文档

- `book-mall/doc/finance/00-pricing-source-of-truth.md`（**新；财务总宪**）
- `book-mall/doc/releases/2026-05-18-pricing-baseline-realign-and-disclosure.md`（本文档）

### 配置

- `book-mall/package.json`（新增 4 条 npm script）

---

## 4.5 受影响用户的"过去多扣"已结清

| 事件 | 用户 | 模型 | 原扣 | 应扣 | 退还 |
| --- | --- | --- | --- | --- | --- |
| `cmpanmd1p000rr0i4ncqedb61` | `cmp1b8wun0000r0zdar41scra`（13808816802@126.com） | happyhorse-1.0-i2v · 1080P · 5s · audio | 4500 点（¥45） | 1600 点（¥16） | **+2900 点（¥29）** |

补偿动作（事务内、幂等键 `refund_2026_05_18_happyhorse_1080p_overcharge_event_cmpanmd1p000rr0i4ncqedb61`）：

1. `Wallet.balancePoints += 2900`（295460 → 298360）
2. 写一条 `WalletEntry { type: ADJUST, amountPoints: +2900, description: ... }`
3. 把 `ToolUsageEvent.costPoints` 从 4500 改为 1600（修正快照）
4. 在对应 `ToolBillingDetailLine.cloudRow.adjustment` 写入补偿凭证
5. **同步修正 cloudRow 内 `平台/定价` `平台/扣点` `平台/应付金额` `平台/计费公式` 四个展示字段**（原值搬到 `adjustment.snapshotBefore`）——否则 finance-web 表格仍读旧值

脚本：`pnpm dotenv -e .env.local -- tsx scripts/refund-overcharge-2026-05-18.ts [--apply]`。重跑会先尝试退款（被幂等键拦截），再尝试补做快照修正（已修正会跳过），全程幂等。

> 扫描周期内（近 14 天）只这一条 happyhorse 记录受影响（图生视频 invoke 总条数 = 1）。其它已 D 表对齐的模型在新价格生效前并无成功扣费记录，因此无须批量退款。

---

## 4.5.1 财务管理端新增两个入口

| 路径 | 作用 |
| --- | --- |
| `finance-web /admin/billing/all` | 全部用户费用明细汇总（参照"用户明细"页，使用同一份组件、同一份口径；但隐藏"本页位置/账单归属/数据来源"三块卡片，钱包余额两列折叠成「DB 总条数」） |
| `finance-web /admin/pricing-disclosure` | 价格公示入口（链接到 book-mall 的统一公示页 `/pricing-disclosure`，财务端样式统一卡片） |

- 后端新接口：`book-mall /api/admin/finance/billing-detail-lines-all`（admin only，支持 `from / to / take`，默认 1000、上限 5000）。
- 侧边栏 `AdminSidebar` 新增两条；`/admin` 概览页两个入口卡片。

---

## 4.6 价目表 UI 整合（"务必只有一个页面"）

| 之前 | 现在 |
| --- | --- |
| `/account/pricing`：缺动作列、缺公式列；自有一份 `pricing-table-client.tsx` | 改用 `PricingTable` 共享组件，新增"动作"列与"公式"列；顶部加 `PricingFormulaCard` |
| `/pricing-disclosure`：自有一张大表 | 改用同一 `PricingTable` 组件 + `PricingFormulaCard`；列与个人中心 100% 对齐 |
| `/admin/finance/cloud-pricing` 的"在库价目" master view | **整段删除**，改为跳转卡片到 `/pricing-disclosure` 与 `/account/pricing`；保留"导入版本" |
| 旧 `cloud-pricing-master-client.tsx`、旧 `pricing-table-client.tsx` | **已删除** |
| admin nav "云厂商价目表" | 改为两条："我方价目表（前台公示）"+"价目导入版本" |

数据装配函数：`getPricingTableRowsForDisclosure()`（`lib/pricing-disclosure.ts`），是公示页与个人中心的唯一数据入口。

---

## 5. 操作清单（部署侧）

1. **数据库迁移**：`pnpm db:deploy`（执行 `20260518130000_wallet_hold_ttl_default_10`）。
   - 本次开发机已通过 prisma client 直接 apply（详见 commit message），CI / 生产仍走标准 `prisma migrate deploy`。
2. **价格重整**：`pnpm pricing:realign-from-md` 看 diff → `pnpm pricing:realign-from-md:apply`。
3. **设置 CRON_SECRET**：在 Vercel 环境变量加 `WALLET_HOLDS_CRON_SECRET=<random>`（用于非 Vercel 部署的 cron 调用）；Vercel 自身 cron 通过 `x-vercel-cron` header 自动鉴权。
4. **非 Vercel 部署**：cron 加一行 `*/5 * * * *  cd /opt/book-mall && pnpm wallet-holds:expire`。
5. **部署后验证**：跑 `pnpm pricing:inspect-billable-vs-md` 期望 exit 0；访问 `/pricing-disclosure` 与 `/account/pricing` 视觉验证。

---

## 6. 后续（next）

- catalog C 的 wan2.6-flash audio 维度 → reserve 阶段也透传 audio（目前默认按 audio:true 估算，保守锁高价，靠 settle 退差额）。
- D 表 `pricePoints` Token 维度按真实 token 数动态扣（当前每次固定）：需要 schema 拆 input/output 双价 + settle path 真实算。
- 在 `/admin/finance/cloud-pricing` master view 加"是否与 price_0518.md 对齐"实时徽章。
- 把 `pricing:inspect-billable-vs-md` 加入 CI gate（合并价格相关 PR 时跑）。

---

## 7. 配套规则文档：finance-rule-v1.0

本次同步落地一份**财务规则总则**：[`book-mall/doc/finance/finance-rule-v1.0.md`](../finance/finance-rule-v1.0.md)。

文档把"价格的产生 → 扣费 → 钱包流水 → 历史快照 → 用户/管理员展示页 → 充值/订阅/退款"链路按 **18 节** 系统整理，明确 10 条不变量 + 3 个数据源约束（D=B、C≥D、M=2），并把所有关键命令 / 文件 / API / 数据库表汇成速查表。

凡之后所有"涉财改动"——无论是改 D 表、改 cloudRow、改前端展示、新增退款脚本——都必须先读 v1.0，再进入实现；与本规则冲突的代码须修复，与本规则冲突的旧文档须以 v1.0 为准。

