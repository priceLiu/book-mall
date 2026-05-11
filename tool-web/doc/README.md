# AI 工具站（tool-web）文档索引

本目录描述 **独立工具站** 的产品约定、技术说明与运维流程。代码根目录：`private_website/tool-web/`。

| 文档 | 说明 |
|------|------|
| [product/overview.md](./product/overview.md) | 定位、功能范围、与主站关系 |
| [tech/sso-session-troubleshooting.md](./tech/sso-session-troubleshooting.md) | SSO、`tools_token`、`TOOLS_PUBLIC_ORIGIN` 与常见问题（含「从主站过来仍提示未登录」） |
| [tech/layout-and-responsive.md](./tech/layout-and-responsive.md) | 壳层布局、左侧导航、移动端与桌面独占工具 |
| [process/deployment.md](./process/deployment.md) | 环境变量、构建发布、与主站联调 |

主站侧 SSO 环境变量与 HTTP API 总表：[`../../book-mall/doc/tech/tools-sso-environment.md`](../../book-mall/doc/tech/tools-sso-environment.md)。

Cursor 在本仓库内编辑工具站时的约定：[`../.cursor/rules/tool-web-dev.mdc`](../.cursor/rules/tool-web-dev.mdc)。
