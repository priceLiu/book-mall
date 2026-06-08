# 火山方舟 Seedance 2.0 · Gateway 实现对照表

> 架构说明见 [gateway-volcengine-architecture.md](./tech/gateway-volcengine-architecture.md)。

## 参考 curl（北京 ARK）

```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "ep-xxxxxxxx或doubao-seedance-2-0-260128",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "image_url", "image_url": { "url": "https://..." }, "role": "reference_image" },
      { "type": "video_url", "video_url": { "url": "https://..." }, "role": "reference_video" },
      { "type": "audio_url", "audio_url": { "url": "https://..." }, "role": "reference_audio" }
    ],
    "generate_audio": true,
    "ratio": "16:9",
    "duration": 11,
    "watermark": false
  }'
```

**勿将 API Key 写入仓库**；用户在 Gateway 控制台绑定 `VOLCENGINE` 凭证即可。

## 能力验收状态

| 能力 | Gateway | 产品层 | 代码入口 |
|------|---------|--------|----------|
| 视频 tasks POST/GET | ✅ | Canvas / Ecom / Story | `volcengine-client.ts`, `volcengine-jobs.ts` |
| `doubao-seedance-2.0` 别名路由 | ✅ | ✅ | `model-router.ts`, `volcengine-chat-models.ts` |
| `ep-*` 接入点路由 | ✅ | ✅ | `model-router.ts`（`ep-` → VOLCENGINE） |
| `reference_image` / `first_frame` | ✅ | ✅ | `canvas-video-volcengine.ts` |
| `reference_video` / `reference_audio` | ✅ | ✅ | `canvas-video-volcengine.ts` |
| `asset://` 人像库引用 | ✅ | ✅ | `canvas-video-volcengine.ts` |
| 豆包 Chat | ✅ | Canvas LLM | `proxy-common.ts` |
| 私域虚拟人像 API（9） | ✅ 透明代理 | — | `/api/gw/v1/volcengine/portrait/virtual/*` |
| 真人人像库 API（2） | ✅ 透明代理 | — | `/api/gw/v1/volcengine/portrait/real/*` |
| Story 分镜视频火山路径 | ✅ | story-web 模型列表 | `story-gateway-client.ts`, `story-task-service.ts` |

## 官方文档

- 计费：https://www.volcengine.com/docs/82379/1544106
- 视频 API：https://www.volcengine.com/docs/82379/1520758
- Seedance 2.0 教程：https://www.volcengine.com/docs/82379/2291680
- 提示词指南：https://www.volcengine.com/docs/82379/2222480
- 私域虚拟人像：https://www.volcengine.com/docs/82379/2333565 · API https://www.volcengine.com/docs/82379/2333601
- 真人人像库：https://www.volcengine.com/docs/82379/2333589 · API https://www.volcengine.com/docs/82379/2333602
