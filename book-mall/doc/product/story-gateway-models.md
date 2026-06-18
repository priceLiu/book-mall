# Story 产品线 · Gateway 模型清单

单一来源：路由见 `book-mall/lib/gateway/model-router.ts`；凭证绑定见 Gateway 控制台；火山架构见 [gateway-volcengine-architecture.md](../tech/gateway-volcengine-architecture.md)。

| 模块 | 应用 | 能力 | 模型（当前） | Gateway 厂商 | 请求类型 |
|------|------|------|-------------|-------------|----------|
| AI试衣 | tool-web | 虚拟试衣 | `aitryon`、`aitryon-plus` 等 | DASHSCOPE | TRYON |
| 文生图 | tool-web | 文生图 | `wanx2.1-t2i-plus` | DASHSCOPE | IMAGE |
| 文生图 | story-web / canvas | 封面/分镜/三视图 | `nano-banana-pro` + KIE catalog | KIE | IMAGE |
| 图生视频实验室 | tool-web | i2v/t2v/ref | `happyhorse-1.0-i2v`、`wan2.7-i2v*` 等 | DASHSCOPE | VIDEO |
| 图生视频 | story-web / canvas | 分镜视频（KIE） | `kling-2.6/image-to-video`、`bytedance/seedance-2` 等 | KIE | VIDEO |
| 图生视频 | story-web / canvas / ecom | 分镜视频（火山） | `doubao-seedance-2.0`、`doubao-seedance-1.5-pro`、`ep-*` | **VOLCENGINE** | VIDEO |
| 视觉实验室·分析室 | tool-web | 多模态分析 | `qwen3.6-plus/flash`、`qwen3-vl-*` 等 | BAILIAN | CHAT |
| 漫剧·创作幻想家 LLM | story-web | 大纲/角色/分镜 | `gemini-3-flash` | KIE | CHAT |
| Canvas 漫剧 LLM | canvas-web | story-*-engine | `google/gemini-3-flash-preview`、DeepSeek、豆包 | KIE / DEEPSEEK / **VOLCENGINE** | CHAT |
| Canvas 三视图 | canvas-web | 3D | `hunyuan-3d-pro`、`hunyuan-3d-express` | HUNYUAN | IMAGE |
| TTS | canvas-web | 配音 | `tts-1`、`tts-1-hd`、`qwen3-tts` | BAILIAN | TTS |
| 人像库 | Gateway API | 私域/真人资产 | `portrait:virtual` / `portrait:real` | **VOLCENGINE** | OTHER |

## 凭证要求（Gateway 控制台绑定）

- **KIE**：漫剧 LLM/图像/视频（`bytedance/seedance-2` 等）
- **火山方舟 (VOLCENGINE)**：Seedance 2.0/1.5 视频、豆包 Chat、`ep-*` 接入点、人像库 API
  - 默认别名 **「火山方舟」**（`VOLCENGINE_API_KEY`）；**分镜视频 1.0** 生视频优先 **「火山方舟 · 分镜视频1.0」**（Key 相同，sk-gw 分池）
  - **影视专业版 2.0** Seedance 生视频默认同上；可选 `gatewayCredentialId` 指定其它已绑定 VOLCENGINE 凭证
  - 路由：`volcengine-credential-pick.ts` · 架构见 [gateway-volcengine-architecture.md](../tech/gateway-volcengine-architecture.md) §7
- **DeepSeek**：Canvas Story LLM 兜底
- **百炼 (BAILIAN)**：分析室 chat、TTS、百炼 R2V 参考生视频
- **DashScope (DASHSCOPE)**：试衣、文生图、视频实验室
- **混元 3D (HUNYUAN)**：Canvas 三视图

KIE 与火山 Seedance **不混用**：用户在前端选择不同 modelKey；Gateway 按 `routeGatewayModel` 取对应凭证。

## 客户端来源（Logs Source 列）

- `CANVAS` — canvas-web
- `STORY` — story-web 创作幻想家
- `TOOL` — tool-web 试衣/文生图/视频实验室/分析室

Book 个人中心 **一个** `sk-gw-...` 关联上述全部产品。
