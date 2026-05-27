# 影视专业版（story-pro）· 产品需求

> **状态**：需求真源 · 2026-05  
> **关联**：[story-editions-overview.md](./story-editions-overview.md) · [story-pro-workflow-canonical.md](./story-pro-workflow-canonical.md)  
> **参考方法论**：[YubAI-DramaFlow](../YubAI-DramaFlow-main/README.md)（仅文档输入，不 import 运行时）

---

## 1. 双轨划分（强制）

| 名称 | 代号 | 定位 |
|------|------|------|
| **基础快手版** | `story-comic` | 现有四节点工作流；**冻结不改** |
| **影视专业版** | `story-pro` | 五阶段 SOP；**全新节点 type 与 spawn/run 链路** |

**不可共用**：节点 type、data 结构、spawn 模块、runner 分支、Cursor 规则真源。同画布可并存多套，靠 `scriptHubId` / `hubNodeId` + **不同 type 前缀** 隔离。

---

## 2. YubAI 五阶段 ↔ 专业版节点

| YubAI 阶段 | 产出 | 专业版节点 |
|------------|------|------------|
| 故事层 | 大纲、剧本、AI 可行性 | `story-pro-script-hub` |
| 风格层 | 风格定义、锚定词、参考图 | `story-pro-style` |
| 设计层 | 人物、场景 | `story-pro-character` · `story-pro-scene` |
| 分镜层 | 分镜表、静帧 | `story-pro-frame` |
| 视频层 | 视频、TTS | `story-pro-video` · `jianying-export-pro` |

---

## 3. 风格定义（核心差异）

数据字段见 `story-pro-workspace-types.ts` · `StoryProStyleNodeData`：

- `mainStyle` / `colorTone` / `renderQuality`
- `styleAnchorZh` / `styleAnchorEn` / `negativePrompt`（必填定稿）
- `refImages[]`（定稿门槛 ≥3）
- `styleFinalized`

**规则**：未 `styleFinalized` 禁止下游媒体 run；所有生图/生视频 prompt 经 book-mall `prependStoryProStyleAnchor` 注入锚定词，row 级不可关闭。

参考：[YubAI 风格定义模板](../YubAI-DramaFlow-main/templates/风格定义模板.md)

---

## 4. AI 可行性评估（软门禁）

- 故事定稿前展示评估表（场景数、多人镜头、高难度动作等）
- **软门禁**：高风险 checklist → 用户二次确认后可定稿
- 不阻塞快手版

参考：[AI可行性评估模板](../YubAI-DramaFlow-main/templates/AI可行性评估模板.md)

---

## 5. 分镜 row 扩展字段

`StoryProFrameRow`：`shotNo` · `shotSize` · `cameraMove` · `durationSec` · `aiDifficulty` · `sceneRefId`

---

## 6. Gateway（强制）

- 所有 LLM / 生图 / 生视频 / TTS **经 Gateway**，禁止直连厂商
- `clientPage`：`canvas/{projectId}/story-pro`
- 规则真源：[`.cursor/rules/canvas-gateway-no-direct-connect.mdc`](../../.cursor/rules/canvas-gateway-no-direct-connect.mdc)

---

## 7. 非目标

- 不改造快手版节点与 `story-workflow-canonical.md`
- 不让快手版读取专业版 style 锚定
- 不在首期改 Prisma schema（任务仍用 `canvasGenerationTask` + storyScope）
