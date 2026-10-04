# 平台简易剪辑台 · HTTP 契约

## 概述

- **工作台快照**：业务项目 `meta.composeWorkbench`（`PlatformComposeWorkbenchState`）
- **类型 SSOT**：`book-mall/lib/media/platform-compose-workbench.ts`
- **合成**：优先走业务封装（如 SFV `POST .../simple-fusion-video/projects/:id/render`），或通用入口如下。

## POST `/api/sso/tools/media/compose/render`

**鉴权**：Book SSO Platform Bearer（与其它 `api/sso/tools/*` 一致）

**Body**

```json
{
  "workbench": {
    "orderedClipIds": ["look-a"],
    "clips": [
      {
        "id": "look-a",
        "videoUrl": "https://…/clip.mp4",
        "source": "look",
        "sourceStartSec": 0,
        "sourceEndSec": 5.5,
        "subtitle": "可选段字幕",
        "audioUrl": "https://…/tts.mp3"
      }
    ],
    "profile": {
      "transition": { "type": "xfade", "durationSec": 0.6 },
      "subtitle": { "mode": "script", "burnIn": true, "style": { "fontKey": "heiti", "sizeKey": "large" } },
      "video": { "scaleMode": "fit1080p" },
      "audio": { "bgmUrl": "https://…/bgm.mp3", "bgmVolume": 0.35, "mixTts": false, "bgmPresetId": "beat-1" }
    }
  },
  "bgmUrl": "可选，覆盖 BGM 地址",
  "bgmPresetId": "可选；须配合 bgmUrl 或 workbench.profile.audio.bgmUrl",
  "sourceRef": { "app": "ecom", "projectId": "…" }
}
```

**Response**：`{ job: MediaRenderJobDto }`（同 `POST /api/sso/tools/media/render`）

**说明**

- `bgmPresetId` 仅持久化在工作台；服务端合成前会解析为 `audio.bgmUrl`（电商 SFV 在 `resolveComposeRenderProfile` 内用 `SIMPLE_FUSION_BGM_PRESETS` 解析）。
- 段级 `subtitle` + `profile.subtitle.burnIn` + `mode: script` 与画布剪映导出一致；`mode: asr` 走 ASR 烧录（需 Gateway 模型配置）。

## POST `/api/sso/tools/media/render`

低阶入口：直接传 `timeline` + `profile`。工作台适配使用 `composeWorkbenchToRenderPayload()`。

## SFV 业务 API

- `PATCH .../simple-fusion-video/projects/:id` — `meta.composeWorkbench` 持久化
- `POST .../simple-fusion-video/projects/:id/render` — body `{ composeWorkbench? }`，内部 `workbenchToMediaTimeline` + `resolveComposeRenderProfile`
