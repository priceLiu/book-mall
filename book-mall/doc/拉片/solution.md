# 专业拉片 · 技术方案

## 架构

- **真源**：`book-mall/lib/ecom/ecom-film-pull-*`
- **API**：`/api/sso/tools/ecom/film-pull/*`
- **壳**：`e-commerce-toolkit` FilmPullStudio；`canvas-web` 预设 + 导入 Hub

## 常量

| 常量 | 值 |
|------|-----|
| `FILM_PULL_V1_MAX_SEC` | 60 |
| `FILM_PULL_SEGMENT_ENABLED` | false（预留） |
| `FILM_PULL_DEFAULT_VIDEO_MODEL` | wan2.7-r2v |

## 状态机

```
draft → analyzing → analyzed → render_scripting → render_ready
  → generating_shots → shots_ready → rendering → completed | failed
```

## analyzeMode

- `single`：≤60s 单次 Vision LLM（video_url）
- `segmented`：预留（>60s 分段 job + merge）

## Gateway

- 拉片：video-understanding LLM（与拆图拆视频同源白名单）
- 出镜：R2V（`ecom-seed-video-video` 同款轮询链）

## 合成

`fromEcomFilmPullPlan` → `MediaRenderJob`（与种草 video/render 同路径）
