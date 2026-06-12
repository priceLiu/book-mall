# Media Render · Timeline v1

版本：`v1` · 实现：`book-mall/lib/media/timeline-types.ts`

## 概述

云端自动剪辑（Media Render）使用与业务解耦的 **Timeline v1** 描述待合成片段序列。画布剪映导出、电商分镜合并、Platform API 均通过 adapter 映射为同一结构后交给 `runMediaRenderJob`。

## Timeline v1

```json
{
  "version": 1,
  "clips": [
    {
      "order": 0,
      "videoUrl": "https://…/panel-1.mp4",
      "audioUrl": "https://…/tts-1.mp3",
      "subtitle": "台词文本",
      "durationSec": 3.2
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `order` | 是 | 时间线顺序，从 0 递增 |
| `videoUrl` | 是 | 源镜 HTTPS URL；**不复制**到 `media-render/sources/`，渲染时 HTTP 拉流 |
| `audioUrl` | 否 | 配音轨 URL |
| `subtitle` | 否 | 脚本台词；`RenderProfile.subtitle.mode=script` 时用于 SRT |
| `durationSec` | 否 | 缺省由 ffprobe 探测真实时长 |

## RenderProfile

```json
{
  "transition": { "type": "xfade", "durationSec": 0.6 },
  "subtitle": { "mode": "script", "burnIn": false },
  "video": { "scaleMode": "fit1080p" }
}
```

- `transition.type`: `xfade`（默认 0.6s 交叉淡化）或 `none`（concat，兼容旧合并）
- `subtitle.mode`: `script` 使用 clips 台词；`none` 不生成字幕
- `subtitle.burnIn`: `true` 时 ffmpeg 烧录字幕（P1.5+）
- `video.scaleMode`: `fit1080p` 统一 1080p 信箱；`source` 保持源分辨率（需规格一致）

## Adapters

| Adapter | 输入 | 文件 |
|---------|------|------|
| `fromCanvasJianyingFrames` | `JianyingFrameInput[]` | `timeline-adapters.ts` |
| `fromEcomStoryboardSheet` | `StoryboardSheet` | `timeline-adapters.ts` |

## 存储策略

- 成片 OSS：`media-render/ephemeral/{userId}/{jobId}.mp4`
- 默认 `expiresAt = createdAt + 7d`；到期删 OSS 并标记 `EXPIRED`
- 延期入库（P2）：`POST …/media/render/{jobId}/pin` → `media-render/pinned/{userId}/`

## API（P1 对内）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/canvas/projects/[id]/media/render` | 画布提交 job |
| GET | `/api/canvas/media/render/[jobId]` | 轮询状态 |
| POST | `/api/sso/tools/ecom/storyboard/projects/[id]/video/render` | 电商合并成片 |

## API（P2 开放）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sso/tools/media/render` | 调用方自供 `clips` + `profile` |
| POST | `/api/sso/tools/media/render/[jobId]/pin` | 容量包延期保留 |

鉴权：Platform Bearer（`verifyToolsBearer`）。

## 限额（env）

见 `book-mall/lib/media/render-limits.ts` 与全站架构文档 §5。
