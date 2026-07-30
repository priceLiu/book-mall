# 电商 · AI GIF 生成器 · 技术方案（待定）

> **状态：Draft / 待定**  
> **关联**：[ecom.gif.md](./ecom.gif.md)（原始产品规格，含 CogVideoX / SDXL 等未接入模型）  
> **更新**：2026-07-29

---

## 1. 结论

| 项 | 决策 |
|----|------|
| 产品机制 | **文/图 → 短视频 MP4 → FFmpeg → GIF**（与 `ecom.gif.md` 一致） |
| 不采用 | 文档中的 **CogVideoX**、**SDXL**（仓库未在 Gateway 登记） |
| 默认视频模型 | **`happyhorse-1.1-t2v`**（百炼 DashScope） |
| 用户选模 | `StoryboardModelPickerDialog`（`mode: "video"`）+ 白名单 |
| Seedance | **非默认**；可按白名单扩展，MVP 不做 |

当前现网 `ecomImageProcessingGif` 仍走 Seedream **静图**，需按本方案替换为真视频 → GIF 链路。

---

## 2. 模型与路由

### 2.1 白名单（MVP）

```ts
const ECOM_GIF_VIDEO_MODEL_KEYS = [
  "happyhorse-1.1-t2v",
  "happyhorse-1.1-i2v",
  "happyhorse-1.1-r2v",
] as const;

const ECOM_GIF_DEFAULT_VIDEO_MODEL = "happyhorse-1.1-t2v";
```

Phase 2 可扩展 `wan2.7-t2v` / `wan2.7-i2v` 等；是否加入 Seedance 由产品决定。

### 2.2 路由表

| 用户选择 | 无参考图 | 有参考图（`styleImage`） |
|----------|----------|---------------------------|
| `happyhorse-1.1-t2v` | DashScope **T2V** | 自动升 **`happyhorse-1.1-r2v`**（百炼）；单图可优先 **I2V** |
| `happyhorse-1.1-i2v` | 400「请上传参考图」 | DashScope **I2V**（首帧） |
| `happyhorse-1.1-r2v` | 400 或回退 T2V | Bailian **R2V** |

复用现有逻辑：

- T2V/I2V body：`book-mall/lib/canvas/dashscope-sbv1-t2v.ts` · `buildDashscopeHappyhorseT2vVideoBody` / `buildDashscopeHappyhorseI2vVideoBody`
- T2V→R2V 升级：`upgradeDashscopeT2vModelWhenRefsPresent`
- Gateway：`ecomGwCreateDashscopeJob({ kind: "video" })` + `ecomGwPollDashscope`；R2V 用 `ecomGwCreateBailianR2vJob` + `ecomGwPollBailianR2v`（分镜已验证）

### 2.3 生成参数（GIF 专用）

| 参数 | UI | 后端 |
|------|-----|------|
| 时长 | 2 / 3 / 5 秒 | 请求 `max(3, uiDuration)`；FFmpeg `-t uiDuration` 裁剪 |
| 视频分辨率 | — | **720P**（GIF 不必 1080P） |
| GIF 宽 | 256 / 480 / 720 | FFmpeg `scale=` |
| 帧率 | 12 / 24 | FFmpeg `fps=` |
| 画幅 | 1:1 / 16:9 等 | 传给 `aspectRatio` |
| 音频 | — | **`generateAudio: false`** |

HappyHorse 最短 **3 秒**（优于 Seedance 4 秒），更贴近文档「2–3 秒 GIF」。

---

## 3. 后端架构（book-mall）

```
POST .../image-processing/gif/create
    → resolveGifVideoRoute(model, hasRef, aspect, duration)
    → buildGifPrompt（video motion prompt）
    → DashScope T2V/I2V 或 Bailian R2V → 轮询 → MP4 URL
    → 下载临时 MP4
    → gif-ffmpeg：palettegen + paletteuse（可选 gifsicle -O3）
    → uploadCanvasUserBuffer(.gif) → EcomAsset kind=gif
GET .../image-processing/gif/status?taskId=
```

### 3.1 新建模块

| 文件 | 职责 |
|------|------|
| `lib/ecom/ecom-gif-pipeline.ts` | 编排：视频生成 → 转码 → OSS → 落库 |
| `lib/ecom/ecom-gif-video.ts` | `ecomCreateAndPollDashscopeVideo`、Bailian R2V 封装 |
| `lib/media/gif-ffmpeg.ts` | FFmpeg 双 pass（参考 `render-ffmpeg.ts`） |

Docker 已含 **ffmpeg**；**gifsicle** 可 Phase 1.5 加入。

### 3.2 API 形态

建议 SSO 路径（非文档原 `/api/gif/*`）：

- `POST /api/sso/tools/ecom/image-processing/gif/create` → `{ taskId }`
- `GET  /api/sso/tools/ecom/image-processing/gif/status?taskId=` → `{ status, gifUrl?, failMessage? }`

任务状态：`pending` → `generating_video` → `converting_gif` → `success` | `failed`

同步 MVP 备选：改 `edit?mode=gif` + `maxDuration=300`（不推荐长期使用）。

### 3.3 计费

按 **视频模型秒价**（HappyHorse 720P ≈ 0.9 元/秒），不是静图价。`clientPage`: `ecom-gif/{workspaceId}`。

---

## 4. 前端（e-commerce-toolkit）

| 变更 | 说明 |
|------|------|
| 移除 Seedream 静图选择器 | GIF 面板当前误用 `T2I_MODEL_OPTIONS` |
| 接入 `StoryboardModelPickerDialog` | `mode: "video"`，数据来自 Gateway `videoModels` ∩ 白名单 |
| 默认模型 | `happyhorse-1.1-t2v` |
| 内联结果 + 轮询 | 面板内预览 `.gif`；生成后 `scrollIntoView` |
| 文案 | 「先渲染 ≥3 秒短视频，再转为 GIF；导出时长按选择裁剪」 |

---

## 5. 与 `ecom.gif.md` 的差异（刻意为之）

| 原稿 | 本方案 |
|------|--------|
| CogVideoX 免费池 | HappyHorse 1.1（已接入、可计费、可观测） |
| SDXL 参考图预处理 | Seedance/HH **I2V 首帧** 或 **R2V**，少一步 |
| 2–3 秒成片 | 生成 3s → FFmpeg 裁切 |
| 独立 `/api/gif/*` | `/api/sso/tools/ecom/image-processing/gif/*` |
| gifsicle 必装 | Phase 1 可仅 FFmpeg |

---

## 6. 实施阶段

| 阶段 | 内容 |
|------|------|
| **Phase 0** | 本文档 + GIF 面板文案/模型 Picker 占位 + 内联预览 |
| **Phase 1** | HappyHorse 1.1 pipeline + FFmpeg + 异步 API |
| **Phase 2** | 多版本并行、gifsicle、可选 Wan 2.7 |
| **Phase 3** | 计费对齐、单用户并发限制（防 FFmpeg CPU） |

---

## 7. 验收标准

1. 返回真实 **`.gif` OSS URL**（非 PNG/JPG）
2. 纯 prompt T2V、单图 I2V、有图 R2V 三路可通
3. 256px / 12fps 场景文件体积可控（聊天/Discord）
4. 失败展示 Gateway `failMessage`，非笼统「请检查 prompt」

---

## 8. 现网差距（实施前）

```text
ecomImageProcessingGif → ecomImageProcessingTextToImage（Seedream 静图）
image-gif-panel 文案写 Seedream/KIE
defaults.gif → doubao-seedream-5-0-lite（models route）
结果区仅在 studio 页底，长页面不可见
```

实施时以本方案替换上述链路。
