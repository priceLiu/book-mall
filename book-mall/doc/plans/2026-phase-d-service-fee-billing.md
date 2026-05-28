# Phase D：技术服务费 + Gateway 财务改造

- **创建日期**：2026-05-27  
- **状态**：已完成（整站未上线，一次性改造）  
- **关联产品**：[13-tool-service-fee-and-wallet.md](../product/13-tool-service-fee-and-wallet.md)  
- **关联逻辑**：[tool-monthly-service-fee.md](../logic/tool-monthly-service-fee.md)  
- **总计划**：[2026-platform-unification-rollout.md](./2026-platform-unification-rollout.md) §6

## 背景与目标

工具 AI 调用 **全部经 Gateway（用户 BYOK）**；Book **不再**对每次生成按 Scheme A 扣点。  
工具使用权改为 **按月技术服务费**（从钱包扣固定点数）；**课程会员计划仍只覆盖课程**。

## 已确认产品决策

| 项 | 决策 |
|----|------|
| 按次扣点 | 退役（reserve/settle、单次 billable-hint） |
| 课程订阅 | `Subscription` 会员计划 **仅课程** |
| 工具准入 | 有效 **工具技术服务费周期** + Gateway 已关联 |
| 钱包/充值 | 储备余额以支付 **按月技术服务费** |
| 云厂商成本 | 用户自担；平台侧报表 **TBD** |

## Gateway 核查矩阵

| 应用 / 功能 | Gateway | 关键路径 |
|-------------|---------|----------|
| tool-web 试衣/文生图/视频/客服/视觉实验室 | 是 | `tool-web/lib/forward-gateway-*` → `/api/sso/tools/gateway/*` |
| canvas-web | 是 | book-mall `canvas-gateway-client` + `assertGatewayApiKeyLinkedForUser` |
| story-web | 是 | book-mall `story-gateway-client` |
| gateway-web | 是 | BYOK 控制台 |

**残留（D0）**：tool-web 直连 DashScope 函数已 `@deprecated`；story `createKieTask` 已标记；admin 系统 Provider 测试仍用平台 `.env`（非用户路径）。

## 任务清单

### D0 — Gateway 基线与清理

- [x] Gateway 路径矩阵写入本文
- [x] 标记 deprecated / 清理直连 dead code（保留 body helper）
- [x] start/settle 不再 reserve/扣点（service fee 模式）
- [x] 系统 Provider test 在 logic 文档注明非用户路径（见 Gateway 矩阵「残留」）

### D1 — 数据模型与配置

- [x] `ToolServiceFeePlan` + `UserToolServicePeriod` Prisma + 迁移
- [x] `schema-changelog.md` 登记
- [x] seed 默认月费（试衣 3000 点/月，其余占位）
- [x] 开通 server action + `/account/tool-service-fee` + `/admin/tool-service-fee`

### D2 — 准入改造

- [x] `getToolsSsoEligibility`：退役 gold 充值线 → 有效工具服务期
- [x] `resolveToolsNavKeysForUser`：来自 `UserToolServicePeriod`
- [x] `introspect` 返回 `tool_service_periods`
- [x] 更新 `08-independent-tools-sso.md` legacy 说明

### D3 — 月费引擎 + 退役按次扣费

- [x] `lib/tool-service-fee/charge-monthly.ts`
- [x] 开通/续订时扣钱包（方案 A：手动开通/续订）
- [x] `usage` reserve/settle 对 AI toolKey 跳过扣点
- [x] tool-web start 移除 `reserveBefore*`

### D4 — 前端 UX

- [x] 生成按钮：技术服务费文案（billable-hint + chargeLine）
- [x] 账户「工具技术服务费」页
- [x] billable-hint 返回 serviceFeeMode

### D5 — 验收与文档

- [x] 场景验收（见下，代码路径已就绪）
- [x] `finance-rule-v1.0` 附录 A
- [x] 总计划 Phase D 勾选同步（见 rollout §6）

## 验收标准

1. 仅课程订阅 → 可学课程，**不可**用工具（无服务期）。
2. 充值 + 开通试衣月费 → 可试衣；生成走 Gateway；**无**按次扣点。
3. 月费到期或余额不足开通失败 → introspect 不含对应 navKey。
4. 未关联 Gateway → `GATEWAY_KEY_REQUIRED`。

## 待定（TBD）

| 项 | 说明 |
|----|------|
| 各工具月费点数 | admin `ToolServiceFeePlan` 可配；试衣 3000 为示例 |
| 云厂商平台视图 | Gateway 报表扩展，不在本 Phase |
| 自动续费 cron | 首期仅「手动开通/续订扣款」 |

## 备注

- 编码任务完成后在本文件勾选 `[x]`。  
- 勿与 [2026-platform-unification-rollout.md](./2026-platform-unification-rollout.md) 重复维护细项，总计划仅链接本文进度。
