# 布局与响应式约定

## 壳层结构（`components/tool-shell*.tsx`）

- **左侧固定侧栏**：品牌标题下依次为 **「回到主站」**（与工具项相同的 `tool-nav-link` 样式）、**横线分隔**、可折叠 **工具列表**；**回到主站** 在新标签打开 `MAIN_SITE_ORIGIN`。
- **顶栏**：站点菜单按钮区域、用户 **头像**（JWT `image` 或 introspect；须 `https`）；缺失则用昵称 / 邮箱首字、`email` / `name`、`tools_role`、**重新连接**（主站 `re-enter`，`redirect` 为当前路径）。
- **主区域**：`.tool-root` + `.tool-main-scroll` 占满视口高度（`min-height: 100dvh`），内容在 `.tw-main` 内纵向滚动。

## 会话与分层校验（壳层）

- **优先**：`tools_token` Cookie 内的短时 JWT，本站用 **`TOOLS_SSO_JWT_SECRET`** 本地验签后即渲染顶栏（字段来自换票时写入的 `email`/`name`/`image`/`tier`）。实现：`lib/tools-jwt.ts`、`lib/resolve-tools-shell-session.ts`。  
- **降级**：未配置密钥或 JWT 无效/过期时，壳层退回 **`GET` 主站 introspect**（与原先一致）。  
- **实时权威**：封号、黄金会员丢失等仍以 introspect / 业务 Route 为准；JWT TTL 内壳层可能短暂滞后，可缩短主站 `TOOLS_SSO_JWT_TTL_SECONDS`。  

### 多工具入口与未来扩展

- **导航**：继续用 `config/nav-tools.ts` 注册路径；主站 `issue`/`re-enter` 的 `redirect` 指向对应工具路径即可。  
- **域名**：每个浏览器访问的工具站 origin 须与主站 **`TOOLS_PUBLIC_ORIGIN`** 逐项对齐（含 `localhost`/`127.0.0.1`）。  
- **量级**：入口再多也只多一份 JWT；若日后需要在敏感工具「秒级」对齐主站状态，可在该路由 **`fetchToolsSession`** 或专用校验 API，而不必回到「全局每页 introspect」。  

## 移动端（≤767px）

- 侧栏默认收起，通过顶栏 **菜单** 打开 **抽屉 + 遮罩**。
- 关闭方式：点遮罩、点「关闭菜单」、或选中导航链接后自动关闭。

## 桌面端（≥768px）

- 侧栏标题行右侧有 **收起 / 展开** 按钮（‹ / ›）：收起后侧栏宽度为 `--tool-sidebar-w-collapsed`，主内容列随 flex 变宽。
- 通过侧栏 **导航切换路由**（`pathname` 实际变化）后会 **自动收起** 侧栏，并把偏好写入 `localStorage` 键 **`tool-sidebar-collapsed-desktop`**；**首次进入某一 URL 不会**因此收起（仅后续站内跳转触发）。
- 收窄样式仅作用于 `min-width: 768px`；小屏仍沿用抽屉，不展示该按钮。

## 桌面独占工具（可选）

在 `ToolNavItem` 上设置 **`showOnMobile: false`** 可在小屏隐藏该项。  
**必须**在本文件或 `doc/product/overview.md` 中写明原因（例如：依赖大屏画布、需精确指针交互等），避免误以为遗漏。

## 样式入口

- 全局变量与布局类：`app/globals.css`（前缀 `tool-` / `tw-`）。
- 根布局 **`Suspense`** 骨架：`tool-shell-skeleton.tsx`、`tool-skeleton-gears.tsx`（与主站 **`/tools-open`** 同款三齿轮意象；遵守 **`prefers-reduced-motion`**）。
