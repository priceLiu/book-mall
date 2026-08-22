# 首页静态快照（Phase 1）

> **状态**：Phase 1 已实施  
> **SSOT**：[`docs/静态化.md`](../../docs/静态化.md)（需求、ST-* 台账、验收）  
> **管理页**：`/admin/static-snapshots`  
> **公开读 API**：`GET /api/public/static-snapshots/site-home`

## 1. 目标

- 首页 **ISR**（`revalidate = 86400`），用户访问 **不实时查 Prisma** 拉 Gateway 模型。
- **Cron / 管理后台 / CLI** 预生成当日快照写入 `StaticPageSnapshot`。
- 平台应用卡片 showcase 从 **静态 gallery** 聚合，客户端 **视口内 18s 轮换**（视频 hover 才加载）。
- 生成流水写入 `StaticSnapshotGenerationRun`，管理页可查。

## 2. 数据模型

| 表 | 说明 |
|----|------|
| `StaticPageSnapshot` | `pageKey` + `dateKey`(CST) 唯一；`payload` Json |
| `StaticSnapshotGenerationRun` | 每次生成一条流水（CRON / ADMIN / CLI） |

Phase 1 仅 `pageKey = site-home`；**画布门户首页** `canvas-home` 已接入同一套表与 Cron。

## 3. payload 结构

见 [`lib/static-snapshots/site-home-payload.ts`](../lib/static-snapshots/site-home-payload.ts)：

- `hero`：确定性背景 + 3 clips（`dateKey` seed）
- `platformApps`：SSO href + 每 app 最多 5 条 showcase
- `gatewayModels`：Cron 时一次 `listPublicMarketShowcaseModels()`
- `gatewayOrigin`

## 4. 写路径

| 入口 | 路径 / 命令 |
|------|-------------|
| Cron | `POST /api/internal/static-snapshots/generate?pageKey=all`（`CRON_SECRET`，依次生成 site-home + canvas-home） |
| 管理后台 | `/admin/static-snapshots` → 立即生成 |
| CLI | `pnpm --dir book-mall site-home:snapshot-generate` · `canvas-home:snapshot-generate` |

**CloudBase 定时（CST 05:30）**：见 `deploy/tencent/README.md` §九。

成功后 `revalidatePath('/')` 刷新 ISR。

## 5. 读路径

- 首页：`getSiteHomeSnapshotForRender()` → 当日 READY → 昨日 → `buildSiteHomeSnapshotFallback`
- 画布门户：`canvas-web` 首页 SSR 读 `canvas-home` 快照；**「最近项目」**实时 API；**发现/视频墙**不再客户端拉 portal-* 列表。

## 6. showcase 来源（静态 gallery）

| appKey | 来源 |
|--------|------|
| story | `story-theater-videos.manifest.json` |
| tool / quick-replica | `content/quick-replica/builtin-video-gallery.json` |
| common-tools | `builtin-image-gallery.json` |
| 其他 | `platform-app-media.ts` + 上述池扩展 |

## 7. 保留策略

- 快照：每 `pageKey` 保留 **14 天**
- 生成流水：每 `pageKey` 保留最近 **50 条**

## 8. Phase 2（未实施）

其他大流量页复用同一套表与 `/admin/static-snapshots`：`pricing`、`gateway-market`、`pricing-api` 等。

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-22 | canvas-home：画布门户首页快照 + 管理页 Tab + canvas-web 读公开 API |
| 2026-08-22 | Phase 1：首页 ISR + 快照 CMS + 管理页 + Cron |
