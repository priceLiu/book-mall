# Billing / Gateway / 结账 — 待办与已知问题

> **记录日期**：2026-07-11  
> **触发场景**：`13808816802@126.com` 试点账号积分清零后无法在报价页续购；排查 Gateway 平台代付 Key 与 BYOK 身份冲突。  
> **关联文档**：`docs/大额vip.md` · `gateway-platform-vendor-credentials.mdc` · `09-finance-refactor-and-tool-federation.md`

---

## 运维记录（2026-07-11）

已执行 **方案 A**（`scripts/reset-credits-grant-supreme.ts --confirm`）：

| 账号 | 套餐 | 通用积分 | 视频积分 | 周期至 |
|---|---|---:|---:|---|
| `13808816802@126.com` | 个人 · 月付 · 至尊版 | 24,000 | 6,000 | 2026-08-11 |
| `123456789@126.com` | 同上 | 24,000 | 6,000 | 2026-08-11 |

脚本会**全站清零**所有积分账户后再向上述两账号发放至尊版首期；非目标账号余额也会被清零，生产环境慎用。

---

## TODO 清单

### 1. BYOK 套餐：无展示、无购买入口

**现状**

- `/checkout/byok` 已退役，重定向 `/pricing?from=byok-retired`。
- 报价页 `ByokMembershipCta` 文案为「开通个人/团队会员订阅」，实际只滚动到 `#personal` / `#team`，**并未进入独立 BYOK 结账**。
- BYOK 账号点套餐卡「立即开通」会被 `assertBillingPersona(PLATFORM_CREDIT)` 拒绝，跳回 `/pricing?error=byok-persona`。
- 产品口径（积分换算 1.0）：BYOK 准入改会员订阅 + 轻量包，但 **BYOK 身份无法购买平台代付会员**，形成死循环。

**待做**

- [ ] 明确 BYOK 用户续期/准入的产品路径（会员订阅是否应对 BYOK 开放？或恢复独立 BYOK 技术服务费？）。
- [ ] 报价页增加 **BYOK 专属区块**：当前订阅状态、`periodEnd`、续费/开通 CTA。
- [ ] 恢复或新建 BYOK 结账页（或统一会员结账 + 按 `billingPersona` 分流商品）。
- [ ] `getActiveByokSubscription` 与 UI 状态同步：库内 `status=ACTIVE` 但 `periodEnd` 已过期时，页面应显示「已过期」而非静默失效。

**参考**

- `components/pricing/byok-subscribe-buttons.tsx`
- `app/(site)/checkout/byok/page.tsx`
- `lib/billing/byok-subscription-service.ts`

---

### 2. 续费 / 重新购买：前台无可靠自助路径

**现状**

- **平台代付会员**：`/pricing` →「立即开通」→ `/checkout/membership`；仅 `PLATFORM_CREDIT` 账号可用。
- **BYOK 账号**：报价页按钮禁用 + 黄色/蓝色提示；无法线上下单续费。
- **VIP 大额预充**：前台 `/checkout/vip` 重定向 `/pricing`；续充仅 **finance-web** `/admin/vip-ops`。
- **运维脚本**（非用户自助）：
  - `reset-credits-grant-supreme.ts` — 清零 + 发至尊版积分
  - `activateByokSubscription` — BYOK 续期（`ensure-admin-gateway-setup.ts` 在已有 ACTIVE 记录时**不会**续期）
  - `clear-user-credits.ts` — 仅清积分，**不改** `billingPersona` / Gateway 绑定

**待做**

- [ ] 已登录用户续费：按 `billingPersona` + 现有订阅/积分状态，展示**单一明确 CTA**（续会员 / 续 BYOK / VIP 联系商务 / 轻量包充值）。
- [ ] 结账失败禁止静默 `redirect("/pricing")`；已部分落地 `?error=`（`no-plan` / `invalid-plan` / `byok-persona`），需覆盖 topup / vip 等全路径。
- [ ] 过期 BYOK：`ensure-admin-gateway-setup` 或新脚本应支持 **续期**（`periodEnd < now` 时调用 `activateByokSubscription`）。
- [ ] 文档化运营台续充 SOP（VIP、人工补单、管理员 instant checkout 适用角色）。

**参考**

- `app/(site)/checkout/membership/page.tsx`
- `components/pricing/pricing-page-client.tsx`
- `finance-web/components/admin/vip-ops-client.tsx`

---

### 3. 平台管理员与 Gateway 平台代付账号

**现状（已核实 `13808816802@126.com`）**

| 概念 | 值 |
|---|---|
| `PLATFORM_POOL_OWNER_EMAIL`（canonical 凭证池归属） | `13808816802@126.com` |
| Platform Admin Key（代付池管理） | `sk-gw-3e45d14d`，scope=`PLATFORM`，10 条厂商凭证 |
| Book `User.gatewayApiKeyId`（运行时调 API） | `sk-gw-1c72c3b2`，scope=`PERSONAL` |
| 计费身份 | `BYOK`（已锁定） |

**问题**

- 同一 Gateway 账号上并存 **Platform Admin Key** 与 **Personal Key**；Book 侧 BYOK 用户关联的是 Personal Key，易与「平台代付池」概念混淆。
- 其它 Book 管理员（如 `admin@126.com`）通过 `resolveGatewayCredentialScope` **代管** canonical 池，但文档/控制台未向运营说明「谁在代管谁的池」。
- `ensure-admin-gateway-setup.ts` 把试点账号固定为 `BYOK`，与「平台代付池 owner」角色叠加，测试续购时常误判为产品 Bug。

**待做**

- [ ] Book 管理后台 / Gateway 控制台：标注 **平台代付池 Owner**、**当前关联 sk-gw 类型**（PLATFORM vs PERSONAL）。
- [ ] 文档化：`PLATFORM_POOL_OWNER_EMAIL`、Platform Admin Key 与 `User.gatewayApiKeyId` 三者关系（见 `lib/gateway/platform-credential-copy.ts`）。
- [ ] 评估试点账号是否应拆分为两个逻辑角色：**池 Owner**（仅管凭证）vs **测试用户**（BYOK/PLATFORM_CREDIT 各一），避免单账号多义。
- [ ] `copyCanonicalCredentialsToBookUser` / `syncPlatformCredentialPoolForBookUser` 变更时通知运维检查清单。

**参考**

- `lib/gateway/platform-credential-copy.ts`
- `lib/gateway/platform-credential-delegate.ts`
- `scripts/ensure-admin-gateway-setup.ts`
- `.cursor/rules/gateway-platform-vendor-credentials.mdc`

---

## 变更记录

| 日期 | 说明 |
|---|---|
| 2026-07-11 | 初稿：方案 A 执行记录 + 三项 TODO（BYOK 入口、续费路径、平台代付账号） |
| 2026-07-11 | 注册赠送积分准入：`membership-tool-access` 原要求 `planId+monthlyGrant`，仅有 welcome gift 无法进工具站；已改为有余额即可。龙龙账号因 `reset-credits-grant-supreme` 只清零 balance 未清批次导致余额/批次不一致，已 `reconcileCreditBalanceFromLots` 修复。 |

---

## 附录：注册赠送 vs 会员订阅（2026-07-11 核查）

| 问题 | 结论 |
|---|---|
| 注册送积分能否直接用？ | **修复前**：不行，须有有效会员 `planId`。 **修复后**：有可用积分（赠送/充值）即可进工具站。 |
| 赠送积分有效期 | **30 天**（`FREE_VALIDITY_DAYS`，批次 `source=FREE`） |
| 会员套餐积分有效期 | **每 31 天刷新**，周期末未用完**清零不结转**（固定天数，非自然月） |
| 轻量包充值有效期 | **12 个月** |
| 报价页公示 | `/pricing` 底部已嵌入「积分有效期与清零规则」；摘要见计费规则卡片 |
