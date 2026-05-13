# 工具交付清单 — 成片存储与应用历史

每个独立工具上线前应满足下列约定（与主站 **`ToolUsageEvent`**、工具站导航 **`TOOL_NAV_ITEMS`** 对齐）。

## 1. 成片 / 可分享产出（若有）

- **不得长期依赖**上游模型返回的**短期 URL**（如百炼任务输出）。
- 应在工具站服务端将二进制拉回并写入 **自有 OSS**（或等价持久存储），对外暴露 **稳定 HTTPS**（见 `tool-web/doc/aliyun-oss.md` 中 **`ai-fit/result/`** 前缀）。
- 「保存到我的衣柜」等后续流程仅保存上述稳定 URL。

## 2. 应用历史 / 费用流水（主站统一存储）

- **不入库页面浏览**：壳层**不再**自动上报 `page_view`；主站 **`POST /api/sso/tools/usage`** 仅在解析出 **`costMinor > 0`** 时写入 **`ToolUsageEvent`**（未标价或非计费请求返回 `recorded: false`，不落库）。
- **关键业务动作**（如一次试衣成片成功、文生图一次成功调用）：须在**服务端**调用 **`POST /api/sso/tools/usage`**（工具站推荐走 **`POST /api/tool-usage`** 代理），至少包含：
  - **`toolKey`**：与路径换算约定一致或业务键（AI 试衣成片成功使用 `fitting-room__ai-fit`；文生图使用 `text-to-image`）。
  - **`action`**：如 **`try_on`**、**`invoke`**（按定价表匹配）；勿依赖 `page_view` 作为计费依据。
  - **`meta`**（可选 JSON）：`taskId`、稳定 **`resultImageUrl`**、模式等业务字段。
- **`costMinor`**（可选）：单次消耗「分」；未传时由主站按 **`ToolBillablePrice`** / **`PlatformConfig.toolInvokePerCallMinor`**（AI 试衣 try_on 兜底）解析；**解析出正金额后**在同一事务内写入 **`ToolUsageEvent`**、**`WalletEntry(CONSUME)`** 并扣 **`Wallet`**；仍无法标价或余额不足则**不入账 / 402**。

## 3. 用户可见「应用历史」

- 导航 **`/app-history`**：按 Tab 过滤 **`GET /api/tool-usage`** 返回的明细；新工具需在 **`lib/app-history-tabs.ts`** 中补充 Tab 与过滤规则（若需要独立 Tab）。

## 4. 管理后台

- **`/admin/tool-usage`**：按用户维度查看最近打点（含 `costMinor` 与 `meta`）。

## 5. 「实现逻辑」读者页（面向开发者 / 透明度）

- **何时必须做**：新工具首版合并前，或某工具 **计费方式、上游对接、安全边界** 发生重大变更时，须同步更新对应实现逻辑页。
- **路由**：与工具同属一份业务时挂在该业务路径下，例如 `…/implementation`（本期：`/text-to-image/implementation`、`/fitting-room/implementation`、`/fitting-room/ai-fit/implementation`、`/smart-support/implementation`）；若未来工具无单一「首页」，可与架构负责人约定同级路由。
- **必备内容**：
  1. **流程摘要**（浏览器 → Route Handler → 上游 → 持久化 / 计费）。
  2. **关键事项**（密钥不落客户端、`toolKey`/`action`、幂等、402、OSS 与临时 URL 等）。
  3. **核心代码摘录**（真实文件路径 + 短节选；完整源码声明联系站长）。
  4. **页脚**：使用 **`lib/tool-implementation-meta.ts`** 文案（不开源声明 + AI 辅助披露）。
- **导航**：`config/nav-tools.ts` 增加对应菜单项；使用页增加 **`components/tool-implementation-crosslink.tsx`**。
- **组件**：正文骨架 **`components/tool-implementation-doc.tsx`**。

## 相关代码路径

| 说明 | 路径 |
|------|------|
| 成片落 OSS | `tool-web/lib/ai-fit-oss-upload.ts`、`tool-web/app/api/ai-fit/try-on/route.ts`（GET） |
| 上报封装 | `tool-web/lib/forward-tools-usage-server.ts` |
| 主站写入 / 查询 | `book-mall/app/api/sso/tools/usage/route.ts` |
| Prisma 模型 | `book-mall/prisma/schema.prisma` → `ToolUsageEvent` |
| 工具站代理 | `tool-web/app/api/tool-usage/route.ts` |
| 实现逻辑页骨架 / 交叉链接 | `tool-web/components/tool-implementation-doc.tsx`、`tool-web/components/tool-implementation-crosslink.tsx`、`tool-web/lib/tool-implementation-meta.ts` |
