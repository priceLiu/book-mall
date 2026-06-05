# 电商工具箱实施计划

> 权威讨论稿见 Cursor Plan「电商工具箱规划」。本文为仓库内执行摘要。

## 决策摘要

| 项 | 结论 |
|----|------|
| 计费 | 6a 代付按次 + 6b 月费 BYOK，用户可在 Book 个人中心切换 |
| 首期能力 | readme 全目录（图类 + 8 类视频 preset + 品牌长片 + **微剧情分镜故事版**） |
| 端口 / 域名 | 本地 `:3007`；生产 `ecom.ai-code8.com` |
| navKey | `e-commerce-toolkit` |
| toolKey 前缀 | `ecom-toolkit__{module}` + `action` |

## 里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| M0 | Next 脚手架、设计 Token、全屏门户、SSO | 完成 |
| M1 | 双计费、价目 B 层、Gateway E_COMMERCE | 完成 |
| M2 | 图类 6 模块闭环 + 资产库 | 完成 |
| M3 | 视频 8 preset + reserve/settle | 完成 |
| M4 | 宣传片/广告、CloudBase、架构文档 | 完成 |
| M5 | 微剧情分镜故事版（HTML+PNG+Seedance 整片视频） | 完成 |

## M5 故事版要点

- 路由：`/ecom/storyboard/micro-drama`
- 助手：DeepSeek / Gemini 经 Gateway 流式 Chat
- 输出：可变镜数 HTML 故事版 + html2canvas PNG → OSS
- 视频：`doubao-seedance-2.0`（多图参考），4–15s 用户自定，单条成片
- 数据：`EcomStoryboardProject` + BFF `/api/sso/tools/ecom/storyboard/*`

## 依赖

- Book Platform API：`/api/sso/tools/*`
- 价目真源：[doc/price-baseline.md](../doc/price-baseline.md) → `ToolBillablePrice`
- 产品分册：[book-mall/doc/product/e-commerce-toolkit.md](../../book-mall/doc/product/e-commerce-toolkit.md)

## 工程顺序

1. M0 → M1（准入与扣费必须先于生成）
2. M2 图类（复用 Gateway 生图）
3. M3 视频（异步任务 + 按秒 settle）
4. M4 部署与个人中心入口
5. M5 故事版工作室（Prisma → Gateway → BFF → UI）
