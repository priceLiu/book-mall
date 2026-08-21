# AI 小智热闻预生成 + 画布首页异步加载

> 版本：2026-08-21  
> 状态：已实施

## 1. 背景

- **AI 小智**挂载于全站各子应用 layout，共用 [`shared/platform-assistant`](../../../shared/platform-assistant)；后端 **唯一** 在 **book-mall**（`/api/platform-assistant/*`）。
- 热闻由 **Gateway DeepSeek** 预生成并入库，耗时可接受；**禁止**在用户打开抽屉时同步跑 LLM。
- 画布首页「发现」区曾一次并行 3 个列表 API，首屏并发过高。

## 2. AI 小智热闻（全平台共用）

### 2.1 架构

- **写**：仅 book-mall  
  - Cron / 管理驾驶舱 / CLI → Gateway **DeepSeek** → 写入 `PlatformAssistantAiNewsDaily`
- **读**：各子站 UI → `GET /api/platform-assistant/ai-news`（或 BFF / tool-web 代理）→ **只读 DB**
- **预取**：`PlatformAssistant` 在 layout **mount** 时后台 GET，打开抽屉秒显

### 2.2 数据

| 字段 | 说明 |
|------|------|
| `dateKey` | CST `YYYY-MM-DD`，唯一 |
| `content` | 当日 10 条热闻 Markdown 全文 |
| `status` | `READY` / `FAILED` |
| `generatedAt` | 最近成功/失败写入时间 |

保留 **最近 3 个自然日**（约 30 条内容），更早 `prune` 删除。

### 2.3 Cron（CloudBase 定时 HTTP）

鉴权：`Authorization: Bearer ${CRON_SECRET}`

| CST | 路径 |
|-----|------|
| 06:30 | `POST /api/internal/platform-assistant/ai-news/generate` |
| 12:30 | 同上 |
| 18:30 | 同上 |

本地：`pnpm --dir book-mall platform-assistant:ai-news-generate`

### 2.4 环境变量

- `PLATFORM_ASSISTANT_NEWS_MODEL` — 默认 `deepseek-v4-flash`（须在 Gateway 登记）
- `CRON_SECRET` — 仅 CloudBase 定时 HTTP 鉴权（可选；日常可用驾驶舱「立即生成」）

### 2.5 读路径 fallback

1. 当日 `READY` 行  
2. 否则昨日 `READY`（响应 `stale: true`）  
3. 仍无 → 503 +「热闻正在准备中」

## 3. 画布首页异步

- **PortalViewerProvider**：页面级一次 `fetchCanvasViewerUser`
- **发现区**：首屏仅「精选」；模板/案例延迟 300ms 或切 Tab 加载
- **视频作品**：`IntersectionObserver` 进入视口再请求
- 各区块独立 loading / 错误

## 4. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-21 | 初版：DB 持久化热闻 + Cron + UI 预取；画布首页错峰/懒加载 |
