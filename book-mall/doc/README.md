# AI Mall（知识工具订阅站）— 文档导航

实现任何需求前，须先阅读 **[开发约束与流程](./process/development-constraints.md)**，并对照本产品文档体系制定与勾选计划。

## 产品与业务

| 文档 | 说明 |
|------|------|
| [00-overview.md](./product/00-overview.md) | 文档目的、定位、名词、文档关系 |
| [01-catalog-and-permissions.md](./product/01-catalog-and-permissions.md) | 产品分类、权限矩阵 |
| [02-users-billing-and-balance.md](./product/02-users-billing-and-balance.md) | 用户层级、订阅与余额、最低余额线、退款结算 |
| [03-metering-llm-and-tools.md](./product/03-metering-llm-and-tools.md) | 大模型/高阶工具计量方案、水位预警（含后台） |
| [04-user-center.md](./product/04-user-center.md) | 前台用户中心 |
| [05-admin.md](./product/05-admin.md) | 后台管理（含预警与对账） |
| [06-flows.md](./product/06-flows.md) | 核心业务流程 |
| [07-operations.md](./product/07-operations.md) | 运营与公示要求 |
| [08-independent-tools-sso.md](./product/08-independent-tools-sso.md) | 独立工具站 · 黄金会员与 SSO 边界 |

协作需求草案：[**v1.1**](./v1.1)（独立 AI 工具集成 · 试衣间等）。

版本里程碑（大块迭代）：[**v2.0 — 订阅中心 · 工具套件 · 课程占位**](./releases/v2.0-tools-subscription-courses.md)。

## 技术与环境

| 文档 | 说明 |
|------|------|
| [stack-and-environment.md](./tech/stack-and-environment.md) | Neon、Vercel、支付、SSO 摘要、样式与环境变量约定 |
| [tools-sso-environment.md](./tech/tools-sso-environment.md) | 独立工具站 SSO：环境变量、`issue` / `exchange` / `introspect` API |

若外部协作方只接受单文件入口，可使用根目录 **[product.md](./product.md)**（索引）。

| 文档 | 说明 |
|------|------|
| [development-constraints.md](./process/development-constraints.md) | 开发前读文档、计划勾选、归类写入 |
| [mock-payment-checkout.md](./process/mock-payment-checkout.md) | 模拟收银（过渡）：订阅 + 钱包充值、假二维码、`ALLOW_MOCK_PAYMENT` 与安全说明 |
| [real-payment-integration.md](./process/real-payment-integration.md) | **正式接入支付**（支付宝扫码等）：异步通知、幂等、合规要点 |
| [2026-05-11-tools-sso-gold-member.md](./plans/2026-05-11-tools-sso-gold-member.md) | v1.1 工具站 SSO + 黄金会员 — 计划与进度 |
| [schema-changelog.md](./database/schema-changelog.md) | 数据库结构变更登记 |
| [logic/README.md](./logic/README.md) | 功能逻辑类文档存放约定 |
| [tools-sso-session.md](./logic/tools-sso-session.md) | 工具站 SSO 时序、失败分支与实现清单 |

## 模板

| 文档 | 说明 |
|------|------|
| [feature-plan-template.md](./templates/feature-plan-template.md) | 需求开发计划与进度勾选模板 |
