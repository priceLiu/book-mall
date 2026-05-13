# AI 工具站（tool-web）文档索引

本目录描述 **独立工具站** 的产品约定、技术说明与运维流程。代码根目录：`private_website/tool-web/`。

| 文档 | 说明 |
|------|------|
| [product/overview.md](./product/overview.md) | 定位、功能范围、与主站关系 |
| [product/billing-plan-rules.md](./product/billing-plan-rules.md) | **计费计费规则说明**：免责、充值与明细、AI 试衣 / 文生图口径、超时与云账单（站内路由 `/app-history/plan-rules`） |
| [product/fitting-room-and-ai-fit.md](./product/fitting-room-and-ai-fit.md) | 试衣间与 AI 试衣：需求、问题、实现与数据约定 |
| [product/tools-delivery-checklist.md](./product/tools-delivery-checklist.md) | 工具交付清单：成片 OSS、打点、应用历史与管理后台 |
| [tech/sso-session-troubleshooting.md](./tech/sso-session-troubleshooting.md) | SSO、`tools_token`、`TOOLS_PUBLIC_ORIGIN` 与常见问题（含「从主站过来仍提示未登录」） |
| [tech/ui-shell-conventions.md](./tech/ui-shell-conventions.md) | **统一 × 关闭、提醒色、重新连接、生成后计费提示** |
| [tech/layout-and-responsive.md](./tech/layout-and-responsive.md) | 壳层布局、左侧导航、移动端与桌面独占工具 |
| [tech/navigation.md](./tech/navigation.md) | **左侧菜单结构与扩展规范**：分组/叶子、命名、默认展开、可访问性、验证清单 |
| [tech/components-ui-tailwind.md](./tech/components-ui-tailwind.md) | **`components/ui` + Tailwind utilities**：与工作站样式的共存方式、文生图 Hero |
| [process/deployment.md](./process/deployment.md) | 环境变量、构建发布、与主站联调 |

主站侧 SSO 环境变量与 HTTP API 总表：[`../../book-mall/doc/tech/tools-sso-environment.md`](../../book-mall/doc/tech/tools-sso-environment.md)。

Cursor 在本仓库内编辑工具站时的约定：[`../.cursor/rules/tool-web-dev.mdc`](../.cursor/rules/tool-web-dev.mdc)、[`../.cursor/rules/tool-web-ui-shell.mdc`](../.cursor/rules/tool-web-ui-shell.mdc)。
