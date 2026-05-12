# 工具交付清单 — 成片存储与应用历史

每个独立工具上线前应满足下列约定（与主站 **`ToolUsageEvent`**、工具站导航 **`TOOL_NAV_ITEMS`** 对齐）。

## 1. 成片 / 可分享产出（若有）

- **不得长期依赖**上游模型返回的**短期 URL**（如百炼任务输出）。
- 应在工具站服务端将二进制拉回并写入 **自有 OSS**（或等价持久存储），对外暴露 **稳定 HTTPS**（见 `tool-web/doc/aliyun-oss.md` 中 **`ai-fit/result/`** 前缀）。
- 「保存到我的衣柜」等后续流程仅保存上述稳定 URL。

## 2. 应用历史打点（主站统一存储）

- **页面浏览**：壳层已通过 **`ToolUsageBeacon`** + **`POST /api/tool-usage`** 按路径生成 `toolKey`（`/a/b` → `a__b`）。
- **关键业务动作**（如一次试衣成功）：须在服务端或客户端调用 **`POST /api/sso/tools/usage`**（工具站推荐走 **`POST /api/tool-usage`** 代理），至少包含：
  - **`toolKey`**：与 Beacon 规则一致或业务约定键（AI 试衣成片成功使用 `fitting-room__ai-fit`）。
  - **`action`**：如 `page_view`、`try_on`、`invoke`。
  - **`meta`**（可选 JSON）：`taskId`、稳定 **`resultImageUrl`**、模式等业务字段。
- **`costMinor`**（可选）：单次消耗「分」；未传时 AI 试衣 **`try_on`** 可由主站按 **`PlatformConfig.toolInvokePerCallMinor`** 自动写入。

## 3. 用户可见「应用历史」

- 导航 **`/app-history`**：按 Tab 过滤 **`GET /api/tool-usage`** 返回的明细；新工具需在 **`lib/app-history-tabs.ts`** 中补充 Tab 与过滤规则（若需要独立 Tab）。

## 4. 管理后台

- **`/admin/tool-usage`**：按用户维度查看最近打点（含 `costMinor` 与 `meta`）。

## 相关代码路径

| 说明 | 路径 |
|------|------|
| 成片落 OSS | `tool-web/lib/ai-fit-oss-upload.ts`、`tool-web/app/api/ai-fit/try-on/route.ts`（GET） |
| 上报封装 | `tool-web/lib/forward-tools-usage-server.ts` |
| 主站写入 / 查询 | `book-mall/app/api/sso/tools/usage/route.ts` |
| Prisma 模型 | `book-mall/prisma/schema.prisma` → `ToolUsageEvent` |
| 工具站代理 | `tool-web/app/api/tool-usage/route.ts` |
