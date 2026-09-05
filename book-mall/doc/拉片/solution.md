# 专业拉片 · 技术方案 V2

- **真源**：`book-mall/lib/ecom/ecom-film-pull-*`
- **API**：`/api/sso/tools/ecom/film-pull/*`
- **壳**：`e-commerce-toolkit` FilmPullStudio；`canvas-web` 剧本 Hub 专业版原生拉片（`pro2-production-script` v3）
- **V2 变更**：制作链路 **不再** 绑定 seed-video / `replicaSeedVideoProjectId`；使用项目内 `refMatch` + `productionPlan`

## 常量

| 常量 | 值 |
|------|-----|
| `FILM_PULL_V1_MAX_SEC` | 90 |
| `FILM_PULL_SEGMENT_ENABLED` | false |
| `FILM_PULL_DEFAULT_VIDEO_MODEL` | wan2.7-r2v |

## 状态机

```
draft → analyzing → analyzed
  → replica_collecting（一键复刻 + 素材）
  → ref_match_ready → ref_match_confirmed
  → production_scripting → production_ready
  → generating_shots → shots_ready → rendering → completed | failed
```

## 数据字段（EcomFilmPullProject JSON）

| 字段 | 说明 |
|------|------|
| `analyzeResult` | 拉片只读结果 |
| `characterRefs` | 模特/产品 OSS 参考图 |
| `refMatch` | 每镜 modelRefIds / productRefIds |
| `productionPlan` | 制作脚本 + 出图/出视频 URL |
| `meta.refMatchConfirmedAt` | 参考图匹配确认时间 |
| `meta.productionScriptConfirmedAt` | 制作脚本确认时间 |
| `meta.productBrief` | 产品描述 |

## API 一览（V2 新增）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `.../replica/start` | 开始一键复刻（清空旧 production，进入素材采集） |
| POST | `.../refs/upload` | 上传模特/产品 ref |
| POST | `.../ref-match/auto` | 自动匹配每镜 ref |
| PATCH | `.../ref-match` | 更新单镜 ref |
| POST | `.../ref-match/confirm` | 确认参考图匹配 |
| POST | `.../production/assemble` | 组装制作脚本 |
| PATCH | `.../production/shots/:shotNo` | 更新单镜制作字段 |
| POST | `.../production/confirm` | 确认制作脚本 |
| POST | `.../shots/:shotNo/image/generate` | 单镜生图 |
| POST | `.../shots/:shotNo/video/generate` | 单镜生视频 |
| POST | `.../shots/video/generate-batch` | 批量生视频 |
| POST | `.../video/render` | 合成成片 |

## Gateway

- 拉片：video-understanding LLM
- 匹配/组装（可选）：LLM + `film-pull-ref-match` / 规则引擎
- 生图：`generateEcomImage`（IMAGE 模型）
- 生视频：R2V / I2V（有分镜图优先 I2V）
- 合成：`MediaRenderJob`（与种草同路径）

## 与 seed-video 解耦

- **拆图拆视频** 一键复刻仍走 `ecom-media-decompose-replica` → seed-video
- **专业拉片** 一键复刻仅写 `characterRefs` + `refMatch` + `productionPlan`，**不** 创建 seed-video 项目
