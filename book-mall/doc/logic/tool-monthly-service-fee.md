# 工具按月技术服务费 — 业务规则

> **产品分册**：[13-tool-service-fee-and-wallet.md](../product/13-tool-service-fee-and-wallet.md)  
> **实施计划**：[../plans/2026-phase-d-service-fee-billing.md](../plans/2026-phase-d-service-fee-billing.md)

## 1. 两条收费线

| 收费线 | 对象 | 周期 | 支付方式 |
|--------|------|------|----------|
| **课程会员订阅** | 知识型内容（课程学习） | 月/年 | 订单 `Order`（**不可**用钱包抵扣订阅费） |
| **工具技术服务费** | AI 工具套件使用权（`toolNavKey`） | **按月** | 钱包扣点（开通/续订时一次性扣当月周期费） |

二者 **独立**：买课程订阅 **不** 赠送工具使用权；开工具 **不** 需要课程订阅。

## 2. 工具使用与 Gateway

- 用户须在 Gateway 绑定厂商 Key 并关联 Book（`User.gatewayApiKeyId`）。
- 所有 AI 生成经 Gateway 代理；**云厂商账单由用户自担**。
- Book **不对**每次生成扣点（退役 Scheme A 按次 settle）。

## 3. 开通与续订（方案 A：即时扣款）

1. 用户选择工具（`toolNavKey`）点击「开通 / 续订」。
2. 读取 `ToolServiceFeePlan.monthlyFeePoints`（0 = 免费套件，跳过扣款仍可开通）。
3. 若 `monthlyFeePoints > 0`：钱包可用余额须 ≥ 月费；事务内 `WalletEntry` type=`CONSUME`。
4. 写入或延长 `UserToolServicePeriod`：默认 **+30 天**（从 `max(now, 当前 periodEnd)` 起算）。
5. SSO `tools_nav_keys` 仅包含 **当前有效** 服务期的 navKey。

## 4. 余额不足

- 开通失败：返回 402，文案说明需充值后再开通。
- 已开通但周期结束：introspect 移除该 navKey；工具站 API 403 `forbidden_suite`。
- **不**自动从钱包续扣（cron 续费 TBD）；到期须用户主动续订。

## 5. 与 SSO / 黄金会员（legacy）

- **退役**：「黄金会员 = 须 RECHARGE 历史 + 余额线」作为工具 SSO 条件。
- **保留**：`Wallet` / 充值用于技术服务费；余额线可用于其他高级计量（课程高级型等，见 02 分册）。

## 6. 定价表（TBD — 后台可配）

| toolNavKey | 展示名 | 月费（点） | 备注 |
|------------|--------|-----------|------|
| `fitting-room` | AI 试衣 | 3000 | 示例定价 |
| `text-to-image` | 文生图 | 2000 | 占位 |
| `image-to-video` | 图生视频 | 3000 | 占位 |
| `visual-lab` | 视觉实验室 | 1500 | 占位 |
| `story-theater` | 漫剧剧场 | 2500 | 占位 |
| `ai-poster-canvas` | AI 海报画布 | 2500 | 占位 |
| `smart-support` | 智能客服 | 1000 | 占位 |
| `app-history` | 费用明细 | 0 | 免费 |

100 点 = ¥1（与现有点数口径一致）。

## 7. 非用户路径说明

- **Canvas 系统 Provider 连通性测试**（`/api/canvas/providers/[id]/test`）仍可使用平台 `.env` Key，仅供管理员/debug，非用户生成计费路径。
