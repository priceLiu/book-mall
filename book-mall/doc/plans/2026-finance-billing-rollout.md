# 财务 / Billing 演进 — 分阶段实施（可勾选）

> **母文档**：[09-finance-refactor-and-tool-federation.md](../product/09-finance-refactor-and-tool-federation.md)  
> **用途**：迭代会上勾选进度；条目可增删，勿视为冻结排期。

---

## 阶段 A — 主站内模块化（零新部署单元）

- [ ] 在 `book-mall` 内划定 **财务域目录**（如 `lib/billing/`、`lib/wallet/`），约定 **对外导出** 与 **禁止旁路写 `Wallet` / `WalletEntry`** 的 ESLint / 文档约束（可先人工 Code Review）。
- [ ] 将 **`resolveBillablePricePoints`**、`usage` POST 内事务、**402/幂等** 行为整理为 **单一入口**（减少 Route Handler 内散落重复逻辑）。
- [ ] 为 `POST /api/sso/tools/usage`、GET `billable-prices` 补充 **错误码与 JSON 字段** 说明（可贴在 `tools-sso-environment.md` 或本仓库 `doc/api` 小节）。
- [ ] 工具站侧：梳理 **所有** `fetch(MAIN_SITE + ...)` 调用清单，标注 **可缓存** / **必须实时**；其中 **`introspect` / 余额门禁** 与 **`billable-prices`** 不得共用同一档 TTL（产品口径见 [10 §4.3](../product/10-multimodal-studio-and-finance-master-plan.md)）。
- [ ] **充值 UX**：`tool` / `m` 可 **深链主站收银**（或嵌入收款，按安全评审）；验收 **到账后** 下一次门禁能反映新余额（容忍秒级延迟的写上运维 SLA）。

## 阶段 B — API 版本化与兼容

- [ ] 设计 **`/api/sso/tools/v1/`** 路由前缀（与现有路径 **并行**，默认旧路径仍可用至少 1 个发布周期）。
- [ ] 实现 `v1` 下 **`usage`、`billable-prices`、`scheme-a-retail-multiplier`** 的薄封装或共用 handler，**响应体与旧版一致或显式 bump 版本**。
- [ ] 工具站：`getMainSiteOrigin` 拼接处支持 **可选 `NEXT_PUBLIC_TOOLS_BILLING_API_PREFIX`**（默认空 = 旧路径），便于联调 v1。
- [ ] 在 `deploy.md` / SSO 文档中登记 **弃用时间表**（旧路径何时 410/301）。

## 阶段 C — 读路径降依赖（不改写入真相源）

- [ ] 价目：`GET billable-prices` 增加 **ETag** 或 `updatedAt` 聚合，工具站 **SWR / 磁盘短缓存**。
- [ ] 方案 A：`scheme-a-retail-multiplier` 侧 **延长/分层缓存**（按 `toolKey+modelKey`）；文档写明 ** staleness** 上限与对客展示口径。
- [ ] （可选）工具站 build 时 **静态嵌入** 一段 `pricebook-snapshot.json`（仅兜底，仍以运行时拉取为准）。

## 阶段 D — Billing 进程独立（可选）

- [ ] 新建 **`packages/billing-server`** 或独立仓库：仅暴露 **§10 草案** 中 HTTP；数据层与现有 Prisma 共用或只读尾随主库迁移。
- [ ] **mTLS 或服务 JWT**：工具 → Billing 与 主站 Admin → Billing 的鉴权；工具侧用户态仍用 **tools_token 换 Billing 信令**（需设计 token 交换或验签链）。
- [ ] book-mall Admin、报表改为调 Billing **不写双份**。
- [ ] 发布与回滚 Runbook：Billing 降级时 **拒绝写** 还是 **队列重放**（需业务决策）。

## 阶段 E — 新工具 / 全模态工作室接入

- [ ] 注册 **toolKey 前缀**与主站 **ToolBillablePrice** / catalog 行。
- [ ] 工具站侧栏或远程 nav **登记入口**；SSO 回调与 `TOOLS_PUBLIC_ORIGIN` 评审。
- [ ] 走 **`POST usage` 幂等** 打穿一次端到端（含 402、重复 taskId）。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-13 | 首版：A–E 五阶段检查清单。 |
| 2026-05-13 | 阶段 A：补充充值链路与余额门禁缓存分层（对齐 [10](../product/10-multimodal-studio-and-finance-master-plan.md)）。 |
