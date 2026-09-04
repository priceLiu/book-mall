# 电商短视频工作流 · 模板与 JSON 契约（权威）

> **状态**：首期模板 `outfit-v1`（穿搭视频）  
> **代码 SSOT**：`book-mall/lib/ecom/video-workflow/`  
> **客户端镜像**：`e-commerce-toolkit/lib/video-workflow/`（解析/types 须与 book-mall 一致）  
> **业务 PRD**：[`docs/穿搭视频.md`](../../../docs/穿搭视频.md)  
> **实施台账**：[`docs/电商短视频工作流-实施跟踪.md`](../../../docs/电商短视频工作流-实施跟踪.md)  
> **LLM 总则**：[`llm-json-structured-delivery.md`](./llm-json-structured-delivery.md)

---

## §0 总则

1. **JSON = 模板**：每个可独立部署的短视频工作流（穿搭、卡点换装、运镜等）注册为 **`templateId`**；契约、解析器、UI 列配置、生成策略 **1:1 绑定**。
2. **平台信封统一**：所有模板 API 响应、DB 快照、资产库导出 **必须** 使用 `schemaVersion: "ecom-video-workflow/v1"` 信封，禁止各模块自造根结构。
3. **解析唯一入口**：`parseEcomVideoWorkflow(raw)` → 按 `templateId` dispatch 到模板引擎。
4. **穿搭拆镜不走 LLM 脑补**：`outfit-v1` 的 `scene_split_complete` 由 **后端物理切镜 API** 产出 JSON；禁止用 LLM 虚构分镜脚本。
5. **Prompt 模板内置 + 用户可编辑（§十）**：拆镜 enrich 使用 §十 System Prompt；逐镜生成 **系统预填** 中文正向 Prompt（基础画质 + 光影/场景），用户在「片段生成」面板 **可编辑/清空**；`cameraMove` / `characterAction` **不参与** 生成 Prompt 拼接。

---

## §1 平台信封

所有模板共用根结构：

```typescript
type WorkflowEnvelope<TPayload = unknown> = {
  schemaVersion: "ecom-video-workflow/v1";
  templateId: string; // 如 "outfit-v1"
  action: WorkflowAction;
  taskStatus: "success" | "processing" | "failed";
  taskId: string;
  payload: TPayload;
  failReason?: string;
};
```

### LLM 围栏（助手产出结构化数据时）

```
```ecom-video-workflow
{ ... 完整 WorkflowEnvelope JSON ... }
```
```

- 围栏语言标记 **必须** 为 `ecom-video-workflow`，禁止 `json` / `media-decompose` / `seed-video` 代替。
- 回复整段应为 **唯一** 围栏 + 合法 JSON（无注释、无尾逗号）。
- **API 直返** 时可无围栏，但 JSON 形状与信封一致。

---

## §2 标准 action 枚举

| action | 说明 |
|--------|------|
| `scene_split_complete` | 参考视频拆镜完成 |
| `scene_preview_regenerated` | 单镜预览图重生成 |
| `scenes_edited` | 用户删镜/排序后的快照 |
| `refs_locked` | 模特/服装参考锁定 |
| `shot_generate_complete` | 单镜或批量视频片段生成完成 |
| `compose_complete` | 合成成片完成 |

---

## §3 共享域块

### 3.1 `mediaInput`

```typescript
type WorkflowMediaInput = {
  referenceVideoUrl: string;
  aspectRatio?: "9:16" | "16:9";
};
```

### 3.2 `refs`

```typescript
type WorkflowRefs = {
  referenceVideo?: { ossUrl: string; label?: string };
  model?: { ossUrl: string; source?: "upload" | "library" | "asset"; label?: string };
  clothing?: { ossUrl: string; source?: "upload" | "wardrobe" | "asset"; label?: string };
};
```

### 3.3 `sceneList[]`（分镜 spine）

```typescript
type SceneShot = {
  sceneId: string;
  index: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  cameraType?: string;
  motionType?: string;
  characterAction?: string;
  cameraMove?: string;
  lightingSetup?: string;
  sceneBackground?: string;
  toneContrast?: string;
  /** §十 · enrich 光影/场景识别不足 */
  parseIncomplete?: boolean;
  /** §十 · 用户编辑后的逐镜正向 Prompt（空字符串 = Kling 不传 prompt） */
  userGeneratePrompt?: string;
  previewImageUrl?: string;
  keypointsUrl?: string;
  referenceClipUrl?: string;
  videoUrl?: string;
  status?: "pending" | "generating" | "success" | "failed";
  failReason?: string;
};
```

### 3.4 `composeResult`

```typescript
type WorkflowComposeResult = {
  videoUrl: string;
  coverUrl?: string;
  videoInfo?: {
    durationSec: number;
    resolution: string;
    fps: number;
    aspectRatio: string;
  };
  sceneResultList?: Array<{
    sceneId: string;
    sceneVideoUrl?: string;
    status: "success" | "failed";
  }>;
  constraintResult?: Record<string, unknown>;
};
```

### 3.5 `generateConstraint` / `promptConfig` / `videoConfig`

穿搭模板固定，见 §4；由服务端注入，前端只读展示。

---

## §4 模板 `outfit-v1`

| 项 | 值 |
|----|-----|
| `templateId` | `outfit-v1` |
| `module` | `video-outfit` |
| `toolKey` | `ecom-toolkit__video-outfit` |
| 路由 | `/ecom/outfit-video` |

### 4.1 逐镜生成 Prompt（PRD §十）

**基础正向（系统预填前缀）**：

```
9:16竖屏，商业电商穿搭短视频，高清画质，真实服装面料，画面稳定流畅
```

**预填规则**：`parseIncomplete !== true` 时追加 `lightingSetup` + `sceneBackground`（逗号连接）；**不**追加 `cameraMove` / `characterAction`。

**用户编辑**：`SceneShot.userGeneratePrompt` 持久化；生成前/后/再生成均可改；提交生成时以该字段为准（未设置则按预填规则）。

**negativePrompt**（UI 只读；Kling motion-control API 可不传）：

```
肢体畸形，身体扭曲，人脸漂移闪烁，服装褶皱错乱，画面闪烁抖动，图像模糊，曝光异常，多余肢体，卡通动漫画风
```

### 4.1.1 拆镜 enrich Prompt（§十）

- System：`OUTFIT_SPLIT_V10_SYSTEM_PROMPT`（`ecom-outfit-video-split-prompts.ts`）
- User：物理切镜时间轴 + **每镜 preview 关键帧**（单次 multimodal 调用，一次返回 `scenes[]`）
- 残缺检测 + 最多 2 次重试；失败镜 `parseIncomplete=true`，光影/场景填 `【AI识别不足，请手动编辑】`

### 4.2 拆镜返回 `scene_split_complete`

```json
{
  "schemaVersion": "ecom-video-workflow/v1",
  "templateId": "outfit-v1",
  "action": "scene_split_complete",
  "taskStatus": "success",
  "taskId": "scene_split_xxxx",
  "payload": {
    "mediaInput": { "referenceVideoUrl": "https://…", "aspectRatio": "9:16" },
    "splitConfig": { "minSceneDurationSec": 2, "maxSceneDurationSec": 4 },
    "totalSceneNum": 4,
    "sceneList": [
      {
        "sceneId": "s1",
        "index": 1,
        "startTimeSec": 0,
        "endTimeSec": 3,
        "durationSec": 3,
        "cameraType": "front_static",
        "motionType": "stand_pose",
        "previewImageUrl": "https://…",
        "keypointsUrl": "https://…",
        "status": "pending"
      }
    ]
  }
}
```

### 4.3 逐镜生成请求体（服务端内部，非用户编辑）

```json
{
  "schemaVersion": "ecom-video-workflow/v1",
  "templateId": "outfit-v1",
  "action": "shot_generate_request",
  "payload": {
    "refs": {
      "model": { "ossUrl": "https://…" },
      "clothing": { "ossUrl": "https://…" }
    },
    "sceneTaskList": [
      {
        "sceneId": "s1",
        "keypointsUrl": "https://…",
        "previewImageUrl": "https://…"
      }
    ],
    "videoConfig": {
      "resolution": "1080*1920",
      "fps": 30,
      "aspectRatio": "9:16",
      "actionFidelity": "high"
    },
    "generateConstraint": {
      "keepModelIdentity": true,
      "keepClothingShape": true,
      "keepClothingColor": true,
      "disableBodyDistortion": true,
      "disableFlicker": true
    },
    "promptConfig": {
      "positivePrompt": "…",
      "negativePrompt": "…"
    }
  }
}
```

### 4.4 合成返回 `compose_complete`

```json
{
  "schemaVersion": "ecom-video-workflow/v1",
  "templateId": "outfit-v1",
  "action": "compose_complete",
  "taskStatus": "success",
  "taskId": "compose_xxxx",
  "payload": {
    "composeResult": {
      "videoUrl": "https://…",
      "coverUrl": "https://…",
      "videoInfo": {
        "durationSec": 12,
        "resolution": "1080*1920",
        "fps": 30,
        "aspectRatio": "9:16"
      },
      "sceneResultList": [
        { "sceneId": "s1", "sceneVideoUrl": "https://…", "status": "success" }
      ],
      "constraintResult": {
        "modelIdentityConsistent": true,
        "clothingConsistent": true,
        "motionReductionDegree": "high"
      }
    }
  }
}
```

---

## §5 扩展新模板（示例 `beat-sync-v1`）

1. 在 `video-workflow/templates/beat-sync-v1/` 新增 `schema.ts` / `parser.ts` / `ui-config.ts` / `generation.ts`。
2. 在 `registry.ts` 注册 `templateId: "beat-sync-v1"`。
3. **不修改** 信封 `schemaVersion` 与 §3 共享 spine；仅在 `payload` 增加扩展块，例如：

```typescript
type BeatSyncExtension = {
  beatMarkers: Array<{ timeSec: number; beatIndex: number; label?: string }>;
  swapSchedule?: Array<{ beatIndex: number; clothingRefId: string }>;
  audioSync?: { sourceBgmUrl?: string; snapToBeat: boolean };
};
```

4. 新建模块路由（如 `/ecom/beat-sync-video`）、Prisma `module` 字段、`toolKey`。
5. 补充本文档 § 新模板小节 + 实施台账 + 单测。

---

## §6 LLM 交互约束（强制）

1. **结构化数据只写在 JSON 内**；禁止 Markdown 分镜表、禁止围栏外字段。
2. **新建/升级** 电商短视频工作流 checklist：
   - [ ] `video-workflow-template-spec.md` 登记 `templateId`
   - [ ] zod schema + parser + registry
   - [ ] 客户端镜像 + unit test
   - [ ] UI `ui-config` 列定义
   - [ ] Gateway `clientPage` + 模型 L1–L5（见 `23-new-model-onboarding-mandatory.md`）
3. Code Review：PR 出现未注册模板或 Markdown 交付结构化数据 → **驳回**。

---

## §7 与旧契约对照

| 契约 | 围栏 | 适用场景 | 与 video-workflow 关系 |
|------|------|----------|------------------------|
| `media-decompose` | `` ```media-decompose `` | 拆图拆视频反推 | **独立**；不复用围栏 |
| `seed-video` | `` ```seed-video `` | 种草视频策划 | **独立** |
| `film-pull` | `` ```film-pull `` | 专业拉片 | **独立** |
| `fashion-deliverable` | `` ```fashion-deliverable `` | 服装口播故事版 | **独立** |
| **video-workflow** | `` ```ecom-video-workflow `` 或 API 信封 | 穿搭/卡点/动作迁移类 | **新模板入口** |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-09-04 | 初版：信封 v1、`outfit-v1` 全量契约、扩展指南 |
