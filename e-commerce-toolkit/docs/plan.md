# 电商工具箱实施计划

> 权威讨论稿见 Cursor Plan「电商工具箱规划」。本文为仓库内执行摘要。

## 决策摘要

| 项 | 结论 |
|----|------|
| 计费 | 6a 代付按次 + 6b 月费 BYOK，用户可在 Book 个人中心切换 |
| 首期能力 | readme 全目录（图类 + 8 类视频 preset + 品牌长片） |
| 端口 / 域名 | 本地 `:3007`；生产 `ecom.ai-code8.com` |
| navKey | `e-commerce-toolkit` |
| toolKey 前缀 | `ecom-toolkit__{module}__{action}` |

## 里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| M0 | Next 脚手架、设计 Token、全屏门户、SSO | 进行中 |
| M1 | 双计费、价目 B 层、Gateway E_COMMERCE | 进行中 |
| M2 | 图类 6 模块闭环 + 资产库 | 待办 |
| M3 | 视频 8 preset + reserve/settle | 待办 |
| M4 | 宣传片/广告、CloudBase、架构文档 | 待办 |

## 依赖

- Book Platform API：`/api/sso/tools/*`
- 价目真源：[doc/price-baseline.md](../doc/price-baseline.md) → `ToolBillablePrice`
- 产品分册：[book-mall/doc/product/e-commerce-toolkit.md](../../book-mall/doc/product/e-commerce-toolkit.md)

## 工程顺序

1. M0 → M1（准入与扣费必须先于生成）
2. M2 图类（复用 Gateway 生图）
3. M3 视频（异步任务 + 按秒 settle）
4. M4 部署与个人中心入口
