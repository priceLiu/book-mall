# SSO 与会话排障（tools_token）

## 黄色提示「未检测到工具站会话 / tools_token」是什么意思？

表示 **当前浏览器对工具站域名没有有效的 HttpOnly Cookie `tools_token`**。常见原因：

1. **从未完成换票闭环**  
   直接在地址栏打开工具站某路径（如 `/fitting-room`），而没有经过主站 **`/api/sso/tools/re-enter`** → 登录（如需）→ 302 → 工具站 **`/auth/sso/callback?code=...`**。

2. **Cookie 作用域与访问域名不一致**  
   `tools_token` 是按 **工具站实际访问的 origin** 写入的。若主站配置的 **`TOOLS_PUBLIC_ORIGIN`** 与浏览器地址栏不一致（典型：**`http://localhost:3001` vs `http://127.0.0.1:3001`**），主站签发的跳转会去配置里的 origin，而你若在另一个 host 打开工具站，则 **看不到** 那份 Cookie，页面仍会提示未登录。  
   **处理：** 本地固定用一种写法（建议与 `TOOLS_PUBLIC_ORIGIN` 完全一致），工具站书签也用同一 origin。

3. **令牌过期或主站侧准入变化**  
   introspect 返回 `active: false` 时需从主站 **重新连接**（顶部按钮或个人中心 / 后台入口）。

4. **浏览器隐私策略 / 第三方 Cookie**  
   一般 SSO 为主域跳转换票，不依赖跨站第三方 Cookie；若自行改过 Cookie `SameSite` 或用了极端浏览器插件，可能阻断写入。

## 「我是从主站过来的」为什么仍可能看到图 1？

若你是 **从主站打开了工具站链接**，但：

- 新开标签后 **手动改过 URL 的 host**（localhost ↔ 127.0.0.1），或  
- 主站 **`TOOLS_PUBLIC_ORIGIN`** 指向 A，而你实际在 B 打开工具站，  

则会出现「主站认为已跳转成功」而 **当前标签所在 origin 没有 Cookie** 的现象。统一 origin 即可。

## 操作指引

- 工具站 UI：**顶部「重新连接」**（携带当前路径）或各页中的 **从主站重新连接** 链接。  
- 主站 API：`GET /api/sso/tools/re-enter?redirect=/fitting-room`（路径可按工具页调整）。

## 打开工具站很慢？

常见瓶颈是 **工具站 → 主站 `introspect` → Neon**：免费档 **睡眠唤醒** 或 **连接池紧张** 都会拉长首字节时间。

1. 主站 **`DATABASE_URL`**：使用 Neon **Pooled** URI，含 **`pgbouncer=true`**、足够的 **`connect_timeout`**（见 [`../../../book-mall/doc/tech/stack-and-environment.md`](../../../book-mall/doc/tech/stack-and-environment.md)）。
2. 避免同一库长时间并行 **多个 dev / Studio**。
3. 工具站根布局对 **`ToolShell`** 使用 **`Suspense`** 骨架：先出侧栏 / 顶栏 / 主区占位；骨架内含与主站 **`/tools-open`** 同款 **三齿轮** 动画意象（`components/tool-skeleton-gears.tsx`、`app/globals.css`），并尊重 **`prefers-reduced-motion`**。真实耗时仍以主站与数据库为准。

## 参考

- [`../../../book-mall/doc/tech/tools-sso-environment.md`](../../../book-mall/doc/tech/tools-sso-environment.md)
