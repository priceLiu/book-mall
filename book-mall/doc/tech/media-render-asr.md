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
- **asr**：逐镜 HTTPS 视频 URL → Gateway ASR → `buildAsrSubtitleSrt`（含 xfade 时间偏移）
- **none**：不生成 SRT

## Gateway

- `POST /api/gw/v1/dashscope/asr/transcribe`
- 入参：`{ fileUrl, modelKey? }`
- 出参：`{ segments: [{ startMs, endMs, text }] }`
- 鉴权：用户关联 `sk-gw` + DASHSCOPE 凭证（平台代付或 BYOK）
- 模型登记：`qwen3-asr-flash-filetrans`（迁移 `20260730180000_gateway_qwen3_asr_filetrans`）

## 服务端调用链

1. `runFfmpegMediaRender`（`mode === "asr" && burnIn`）
2. `transcribeClipViaGateway` → `gatewayV1AsrTranscribe`
3. `buildAsrSubtitleSrt` → SRT 文件 → `renderXfade` burn-in

## 前端

`jianying-media-render-actions`：勾选「烧录台词字幕」后可选：

- 分镜对白（script）
- 从视频音频识别（asr）— 提交前检查 Gateway Key 关联

## 限制

- ASR 仅接受 **公网 HTTPS** 音视频 URL（各镜 `videoUrl`）
- 无语音镜：空 segments，该镜无字幕轨
- Job 超时：默认 `MEDIA_RENDER_JOB_TIMEOUT_SEC=900`；ASR 增加逐镜轮询耗时
