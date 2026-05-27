# Story 产品线 · Gateway 模型清单

单一来源：路由见 `book-mall/lib/gateway/model-router.ts`；凭证绑定见 Gateway 控制台。

| 模块 | 应用 | 能力 | 模型（当前） | Gateway 厂商 | 请求类型 |
|------|------|------|-------------|-------------|----------|
| AI试衣 | tool-web | 虚拟试衣 | `aitryon`、`aitryon-plus` 等 | DASHSCOPE | TRYON |
| 文生图 | tool-web | 文生图 | `wanx2.1-t2i-plus` | DASHSCOPE | IMAGE |
| 文生图 | story-web / canvas | 封面/分镜/三视图 | `nano-banana-pro` + KIE catalog | KIE | IMAGE |
| 图生视频实验室 | tool-web | i2v/t2v/ref | `happyhorse-1.0-i2v`、`wan2.7-i2v*` 等 | DASHSCOPE | VIDEO |
| 图生视频 | story-web / canvas | 分镜视频 | `kling-2.6/image-to-video`、`bytedance/seedance-2` 等 | KIE | VIDEO |
| 视觉实验室·分析室 | tool-web | 多模态分析 | `qwen3.6-plus/flash`、`qwen3-vl-*` 等 | BAILIAN | CHAT |
| 漫剧·创作幻想家 LLM | story-web | 大纲/角色/分镜 | `gemini-3-flash` | KIE | CHAT |
| Canvas 漫剧 LLM | canvas-web | story-*-engine | `google/gemini-3-flash-preview`、DeepSeek | KIE / DEEPSEEK | CHAT |
| Canvas 三视图 | canvas-web | 3D | `hunyuan-3d-pro`、`hunyuan-3d-express` | HUNYUAN | IMAGE |
| TTS | canvas-web | 配音 | `tts-1`、`tts-1-hd`、`qwen3-tts` | BAILIAN | TTS |

## 凭证要求（Gateway 控制台绑定）

- **KIE**：漫剧 LLM/图像/视频、Canvas KIE 任务
- **DeepSeek**：Canvas Story LLM 兜底
- **百炼 (BAILIAN)**：分析室 chat、TTS、百炼 R2V 参考生视频
- **DashScope (DASHSCOPE)**：试衣、文生图、视频实验室（`DASHSCOPE_API_KEY`）
- **混元 3D (HUNYUAN)**：Canvas 三视图（sk- 或 TC3 SecretId/Key）

## 客户端来源（Logs Source 列）

- `CANVAS` — canvas-web
- `STORY` — story-web 创作幻想家
- `TOOL` — tool-web 试衣/文生图/视频实验室/分析室

Book 个人中心 **一个** `sk-gw-...` 关联上述全部产品。
