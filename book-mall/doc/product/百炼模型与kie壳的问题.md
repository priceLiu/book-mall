# 百炼模型与 KIE 壳的问题

> **状态**：调研结论存档，供产品/技术决策；**尚未**按本文改路由与默认引擎。  
> **日期**：2026-05-28  
> **策略倾向**：阿里百炼 / DashScope **已有** 的能力，优先走官方 API，**不再经 KIE 聚合**。

---

## 1. 背景

- **KIE**：第三方聚合平台（`book-mall/lib/canvas/providers/kie.ts`），Canvas / Story 大量图像、视频、Gemini LLM 走 KIE。
- **阿里百炼**：含两条接入形态（代码里枚举不同，但同属阿里云 Model Studio）：
  - **BAILIAN**：OpenAI 兼容（`compatible-mode/v1`）+ **参考生视频 R2V**（`happyhorse-1.0-r2v`、`wan2.*-r2v` 等）。
  - **DASHSCOPE**：原生异步 API（`video-synthesis`、文生图、试衣等），工具站视频实验室已用。
- **工具站** 图生视频默认已是百炼：`happyhorse-1.0-i2v`、`wan2.7-i2v`（`tool-web/config/lab-video-models.json`）。
- **Canvas / Story** 分镜视频仍暴露 KIE 别名（如 `wan/2-7-image-to-video`），与官方 `model` 字符串不一致，形成 **双轨冗余**。

### 官方依据（仓库内摘录）

| 材料 | 说明 |
|------|------|
| `tool-web/doc/price.md` | 百炼中国内地价目快照（万相 / HappyHorse / 可灵 / 千问图像等） |
| `tool-web/doc/pic-video.md` | 图生视频首帧 i2v · DashScope HTTP |
| `tool-web/doc/chanaosheng.md` | 参考生视频 R2V · `happyhorse-1.0-r2v` |
| `tool-web/doc/wen-video.md` | 文生视频 t2v |
| [视频生成](https://help.aliyun.com/zh/model-studio/use-video-generation) | 百炼视频模型总览 |
| [可灵 API](https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/) | `kling/kling-v3-*` |
| [万相图生视频 API](https://www.alibabacloud.com/help/zh/model-studio/image-to-video-general-api-reference) | 推荐 `wan2.7-i2v` |

视频创建统一端点（华北2）：

```http
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis
X-DashScope-Async: enable
Authorization: Bearer <DASHSCOPE_API_KEY>
```

---

## 2. 代码中的真源（便于对照）

| 用途 | 路径 |
|------|------|
| KIE 硬编码模型清单 | `book-mall/lib/canvas/providers/kie.ts` → `KIE_KNOWN_MODELS` |
| 百炼 R2V 清单 | `book-mall/lib/canvas/providers/bailian-r2v.ts` |
| Gateway 路由 | `book-mall/lib/gateway/model-router.ts` → `routeGatewayModel` |
| Gateway 控制台目录 | `book-mall/lib/gateway/model-catalog.ts` |
| Story 视频 / 专业版白名单 | `canvas-web/lib/canvas/story-prompts.ts` |
| 默认引擎选择 | `canvas-web/lib/canvas/system-providers.ts` |
| 产品矩阵（简表） | `book-mall/doc/product/story-gateway-models.md` |

---

## 3. 明确重复：阿里已有 → 建议弃 KIE 壳

同一 **产品线 / 能力**，仅 `modelKey` 字符串不同（KIE 多为斜杠路径，百炼为点分官方名）。

| 能力 | KIE `modelKey`（当前） | 百炼官方 `model` | 备注 |
|------|------------------------|------------------|------|
| 万相 2.7 图生视频（首帧 i2v） | `wan/2-7-image-to-video` | `wan2.7-i2v`、`wan2.7-i2v-2026-04-25` | 工具站已用后者 |
| Happy Horse 图生视频（首帧 i2v） | `happyhorse/image-to-video` | `happyhorse-1.0-i2v` | 计费默认亦为 i2v |
| 通义/Qwen 类文生图 | `qwen-text-to-image` | `qwen-image` / `qwen-image-2.0*` / `qwen-image-plus*`；或 `wanx2.1-t2i-plus`、`wan2.6-t2i` 等 | 按画质/编辑需求选型 |

**落地含义**：新请求不应再为上述能力配置 KIE Key；存量项目若仍选 KIE 别名，应迁移到百炼 `model` 并走 `DASHSCOPE` / `BAILIAN` 凭证。

---

## 4. 同厂商、不同代际：可替代但非同名替换

| 能力 | KIE | 百炼官方 | 结论 |
|------|-----|----------|------|
| 可灵 图生视频 | `kling-2.6/image-to-video` | `kling/kling-v3-video-generation`、`kling/kling-v3-omni-video-generation` | 百炼已接 **可灵 v3**（首帧 / 首尾帧 / 参考生等）；需按[可灵 API 文档](https://help.aliyun.com/zh/model-studio/kling-video-generation-api-reference/)改请求体，**不能**只做字符串映射 |

策略：**优先百炼可灵 v3**，停用 KIE 2.6 路径。

---

## 5. 百炼有、KIE 目录无对等项（保留百炼，非重复）

| 类型 | 百炼 `model` 示例 |
|------|-------------------|
| 参考生视频 R2V | `happyhorse-1.0-r2v`、`wan2.7-r2v`、`wan2.6-r2v`、`wan2.6-r2v-flash` |
| 文生视频 t2v | `happyhorse-1.0-t2v`、`wan2.7-t2v`、`wan2.6-t2v` 等 |
| 第三方视频（百炼集市） | `pixverse/*`、`vidu/*` 等 |
| 可灵文生图 | `kling/kling-v3-image-generation` 等 |

专业版 R2V 白名单（`STORY_PRO_VIDEO_BAILIAN_MODEL_KEYS`）与官方一致；`pickDefaultRefVideoEngine` 已 **百炼 R2V 优先**，其次 KIE Seedance。

---

## 6. KIE 有、百炼价目/API 未列出（继续保留 KIE 或接原厂）

`tool-web/doc/price.md` 中国内地快照中 **未出现** 下列品牌（非百炼商品，或不在该快照内）：

| KIE `modelKey` | 说明 |
|----------------|------|
| `bytedance/seedance-2` | 字节 Seedance；百炼无 seedance/豆包视频行 |
| `nano-banana-pro` | Google Nano Banana |
| `flux-2-pro` | BFL Flux |
| `seedream-5-lite` / `seedream-4.5` | 字节 Seedream |
| `gpt-image-1` / `gpt-image-2` | OpenAI GPT Image |
| `google/gemini-3-flash-preview` / `gemini-3-flash` | Gemini；百炼无 Gemini 价目 |

**不宜** 因「优先阿里」删除以上能力。

---

## 7. LLM 补充

| 模型族 | 百炼 | KIE |
|--------|------|-----|
| 通义千问 | `qwen-plus`、`qwen-max`、`qwen3.6-plus` 等 | KIE 目录未主推 Qwen LLM |
| Gemini | 无 | `gemini-3-flash` 等 |
| DeepSeek | 百炼第三方区 `deepseek-v4-*` 等 | 亦可走 DeepSeek provider |

`STORY_LLM_MODEL_KEYS` 中的 `qwen-plus` / `qwen-max` 应走 **百炼**；Gemini 仍适合 KIE。

---

## 8. 决策摘要（待你确认）

### 建议从 KIE 收敛 → 改百炼

1. `wan/2-7-image-to-video` → `wan2.7-i2v`（或 dated 版本）
2. `happyhorse/image-to-video` → `happyhorse-1.0-i2v`
3. `qwen-text-to-image` → `qwen-image-2.0` / `qwen-image-plus` / `wanx2.1-t2i-plus`（按场景）
4. `kling-2.6/image-to-video` → `kling/kling-v3-video-generation` 或 `kling/kling-v3-omni-video-generation`（API 迁移）

### 建议继续 KIE

- Seedance、Nano Banana、Flux、Seedream、GPT Image、Gemini

### 建议仅百炼（勿经 KIE）

- 全部 R2V；工具站视频实验室 / 文生图 / 试衣 / TTS 等已接 DashScope 的能力

---

## 9. 与当前实现的差距（改代码前须知）

| 现象 | 位置 |
|------|------|
| `wan/`、`happyhorse`（非 `-r2v`）、`kling`、`seedance` 等仍路由到 **KIE** | `book-mall/lib/gateway/model-router.ts` |
| 分镜视频默认先扫 **KIE** 上的 `STORY_PRO_VIDEO_MODEL_KEYS`（含 Wan/HappyHorse KIE 别名） | `canvas-web/lib/canvas/system-providers.ts` → `pickDefaultStoryVideoEngine` |
| 参考生视频已百炼优先 | `pickDefaultRefVideoEngine` |
| 工具站 i2v 已是官方 `model` | `tool-web/lib/image-to-video-dashscope.ts`、`lab-video-models.json` |

若确认策略，后续需：调整 `model-router`、Story/Canvas 白名单与默认引擎、Gateway 目录展示，以及可灵 v3 的请求体适配（`gw/v1/jobs/createTask` 或 DashScope 客户端）。

---

## 10. 待思考问题（留白）

- [ ] 存量画布/漫剧项目已绑定 KIE 别名时，是否做 **只读兼容映射** 还是强制迁移？
- [ ] 可灵 v3 与 Kling 2.6 画质/价格/时长参数差异，产品默认选哪条？
- [ ] `seedance-2` 多参考分镜是否保留为 KIE 独有卖点，还是接入火山方舟直连？
- [ ] Gateway 控制台「接入模型」是否对重复项 **隐藏 KIE 行**，仅展示百炼？
- [ ] 价目与 `ModelCatalog` 是否同步补充 `qwen-image-*`、`kling/kling-v3-*`？

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-28 | 初稿：基于百炼官方价目/API 摘录与仓库 KIE 清单对照 |
