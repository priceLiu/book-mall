# Media Render · ASR 烧字幕

> 关联计划：`book-mall/doc/plans/2026-media-render-asr-via-gateway.md`

## 协议

`RenderProfile.subtitle`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mode` | `"script" \| "asr" \| "none"` | 字幕来源 |
| `burnIn` | `boolean` | 是否 ffmpeg 烧录 |
| `asrModelKey` | `string?` | 默认 `qwen3-asr-flash-filetrans` |

- **script**：分镜表对白 → `buildMergedSrt`
- **asr**：先按成片时间线合并预览轨（多镜）→ 提取 MP3 上传 OSS → **一次** Gateway ASR；单镜直接用该镜 `videoUrl`。时间戳相对成片 0 点 → `buildAsrSubtitleSrtFromGlobalSegments`。同时间线 24h 内按 `cacheKey` 复用日志缓存，避免孤儿恢复重复调厂商。
- **none**：不生成 SRT

## Gateway

- `POST /api/gw/v1/dashscope/asr/transcribe`
- 入参：`{ fileUrl, modelKey? }`
- 出参：`{ segments: [{ startMs, endMs, text }] }`
- 鉴权：用户关联 `sk-gw` + DASHSCOPE 凭证（平台代付或 BYOK）
- 模型登记：`qwen3-asr-flash-filetrans`（迁移 `20260730180000_gateway_qwen3_asr_filetrans`）

## 服务端调用链

1. `runFfmpegMediaRender`（`mode === "asr" && burnIn`）
2. 多镜：`renderXfade` 预览合并 → `uploadMediaRenderAsrScratchFromPath`；单镜：直接用镜 `videoUrl`
3. `transcribeMediaTimelineViaGateway`（含 `cacheKey` 缓存）→ `gatewayV1AsrTranscribe`
4. `buildAsrSubtitleSrtFromGlobalSegments` → SRT → `renderXfade` burn-in（`buildSubtitlesFilterExpr` 强制 CJK 字体，避免 Arial 方框）

## 前端

`jianying-media-render-actions`：勾选「烧录台词字幕」后可选：

- 分镜对白（script）
- 从视频音频识别（asr）— 提交前检查 Gateway Key 关联

## 限制

- ASR 仅接受 **公网 HTTPS** 音视频 URL（单镜用 `videoUrl`；多镜用临时 OSS 音轨）
- 无语音：空 segments；若分镜表有对白则回退 `buildAsrSubtitleSrtFromClipScriptFallback`
- Job 超时：默认 `MEDIA_RENDER_JOB_TIMEOUT_SEC=900`；ASR 为单次 filetrans 轮询
