# AI 工具站（tool-web）文档索引

本目录描述 **独立工具站** 的产品约定、技术说明与运维流程。代码根目录：`private_website/tool-web/`。

## 开发前必读（计费 / 视觉实验室）

实现 **扣费、钱包门槛、分析室标价** 等功能前，**必须先读**：

**[product/learning-pricing-dev-prerequisites.md](./product/learning-pricing-dev-prerequisites.md)** — 讨论结论、双层校验（单笔 + 保留水位）、推荐初始保留 **8000 点**、`PlatformConfig` 关系、深度思考与 meta 稽核清单。

---

| 文档 | 说明 |
|------|------|
| [product/overview.md](./product/overview.md) | 定位、功能范围、与主站关系 |
| [product/billing-plan-rules.md](./product/billing-plan-rules.md) | **计费规则说明**：免责、充值与明细、AI 试衣 / 文生图口径、超时与云账单（站内路由 `/app-history/plan-rules`）；**价格表**见 `/app-history/price-list` |
| [product/learning-pricing-dev-prerequisites.md](./product/learning-pricing-dev-prerequisites.md) | **【开发必读】** 学习端计费与水位线、视觉实验室前置约定、推荐初值 8000 点 |
| [product/learning-pricing-requirements.md](./product/learning-pricing-requirements.md) | **学习端轻量报价 · 需求**：国内 only、无免费额度对客、×2.0 系数、范围与非目标、修订跟踪 |
| [product/learning-pricing-solution.md](./product/learning-pricing-solution.md) | **学习端轻量报价 · 方案**：公式、catalog 落地、主站衔接、分期实施、平台复制清单 |
| [product/learning-pricing-tool-onboarding-worksheet.md](./product/learning-pricing-tool-onboarding-worksheet.md) | **工具上架 · 定价工作单**：`price.md` → 解析快照、公式验算、再写主站价目 |
| [product/learning-pricing-wallet-points.md](./product/learning-pricing-wallet-points.md) | **点数与钱包**：点=分 1:1、充值/扣费/introspect 一致、禁止双轨余额（配合主站 `Wallet`） |
| [product/fitting-room-and-ai-fit.md](./product/fitting-room-and-ai-fit.md) | 试衣间与 AI 试衣：需求、问题、实现与数据约定 |
| [product/tools-delivery-checklist.md](./product/tools-delivery-checklist.md) | 工具交付清单：成片 OSS、打点、应用历史与管理后台 |
| [tech/sso-session-troubleshooting.md](./tech/sso-session-troubleshooting.md) | SSO、`tools_token`、`TOOLS_PUBLIC_ORIGIN` 与常见问题（含「从主站过来仍提示未登录」） |
| [tech/ui-shell-conventions.md](./tech/ui-shell-conventions.md) | **统一 × 关闭、提醒色、重新连接、生成后计费提示** |
| [tech/layout-and-responsive.md](./tech/layout-and-responsive.md) | 壳层布局、左侧导航、移动端与桌面独占工具 |
| [tech/navigation.md](./tech/navigation.md) | **左侧菜单结构与扩展规范**：分组/叶子、命名、默认展开、可访问性、验证清单 |
| [tech/components-ui-tailwind.md](./tech/components-ui-tailwind.md) | **`components/ui` + Tailwind utilities**：与工作站样式的共存方式、文生图 Hero |
| [process/deployment.md](./process/deployment.md) | 环境变量、构建发布、与主站联调 |
| [price.md](./price.md) | **中国内地 Token 等官方价目摘录**（维护源）；上架溯源经 `pnpm pricing:extract-price-md` 生成 `config/generated/price-md-china-mainland-extract.json` |
| [reconciliation-baseline-2026-05-16.md](./reconciliation-baseline-2026-05-16.md) | **对帐基础备忘**：需求、价目与流水检查结论、三阶段路线、各工具 `usage` 的 `meta` 键检查表 |
| [pic-video.md](./pic-video.md) | **图生视频（首帧 i2v）**：百炼北京异步 HTTP 要点，与 `lib/image-to-video-dashscope.ts` 对照 |
| [chanaosheng.md](./chanaosheng.md) | 参考生视频（多图 r2v）官方参数摘录 |
| [wen-video.md](./wen-video.md) | 文生视频（t2v）官方参数摘录 |

**通俗整体方案**（多域名、`m.ai-code8.com`、财务从用户到后台到核算）：[`../../book-mall/doc/product/10-multimodal-studio-and-finance-master-plan.md`](../../book-mall/doc/product/10-multimodal-studio-and-finance-master-plan.md)。  

主站侧 **财务重构与多工具联邦架构（技术草案）**：[`../../book-mall/doc/product/09-finance-refactor-and-tool-federation.md`](../../book-mall/doc/product/09-finance-refactor-and-tool-federation.md)。  
实施 checklist：[`../../book-mall/doc/plans/2026-finance-billing-rollout.md`](../../book-mall/doc/plans/2026-finance-billing-rollout.md)。  
主站侧 SSO 环境变量与 HTTP API 总表：[`../../book-mall/doc/tech/tools-sso-environment.md`](../../book-mall/doc/tech/tools-sso-environment.md)。

Cursor 在本仓库内编辑工具站时的约定：[`../.cursor/rules/tool-web-dev.mdc`](../.cursor/rules/tool-web-dev.mdc)、[`../.cursor/rules/tool-web-ui-shell.mdc`](../.cursor/rules/tool-web-ui-shell.mdc)。
