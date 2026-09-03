# 拆图拆视频 · 结构化交付契约（权威）

> **系统只解析回复中唯一 ` ```media-decompose ` 围栏内的 JSON。** 禁止用 Markdown 表格/列表交付结构化数据。

## 硬性规则

1. 回复**整段**应为唯一 ` ```media-decompose ` 围栏，内含**合法 JSON**（无注释、无尾逗号）。允许围栏外零字符；**禁止** Markdown 分镜表与闲聊前言。
2. JSON 根对象必须含 **`mediaType`**（`image` | `video`）与 **`action`**（固定 `decompose_complete`）。
3. **所有结构化数据只写在 JSON 内**。
4. 固定字段名**禁止改名**；必填项**禁止缺项**（见下表）。
5. 按 `mediaType` **只输出对应分支**字段；另一分支键不要写。
6. JSON 内禁止注释；长文用 `\n` 换行。
7. 围栏语言标记必须是 **`media-decompose`**，禁止 `json` / `seed-video` 等代替。

## 回复结构

```
```media-decompose
{ ... 完整 JSON ... }
```
```

---

## 视频分支 `mediaType: "video"`

### 根字段

| 字段 | 类型 | 约束 |
|------|------|------|
| `mediaType` | string | 固定 `"video"` |
| `action` | string | 固定 `"decompose_complete"` |
| `visualStyle` | string | 全片视觉风格/美术 |
| `globalColorTone` | string | 全片色调基调 |
| `cameraLanguageSummary` | string | 全片运镜总述 |
| `scenePrep` | object | 场地与固定道具；见下 |
| `openingHook` | object | **开场 0–3 秒**独立章节；见下。禁止写入分镜行 |
| `fullTranscript` | string | **完整台词全文**；无人口声填「【无任何人声】」 |
| `talentAnalysis` | object | **全片**模特分析（不是前 3 秒）；见下 |
| `wardrobeAnalysis` | object | **全片**模特服装；见下 |
| `storyboardTable` | array | **至少 1 镜** |
| `narrativeLogic` | string | 全片叙事弧线：按时间/镜序写卖点推进与情绪转折，详实不写一句带过 |
| `beatPoints` | string | 带秒数/时间码的卡点；每条含画面事件 + 运镜 + 转场/切换类型 |
| `replicableShootingScript` | string | 可落地复刻脚本：机位、运镜轨迹、切换节奏、布光、走位、BGM、口播时段 |

### `scenePrep`

| 字段 | 说明 |
|------|------|
| `venue` | 主要拍摄场地/环境 |
| `fixedProps` | 固定道具（不含随换产品/服装） |

### `openingHook`（开场 0–3 秒，独立章节）

| 字段 | 说明 |
|------|------|
| `firstFrame` | 第 0 秒画面、人物表情、大字花字、视觉元素 |
| `first3sLines` | 0–3 秒全部人声原文；无则「【无任何人声】」 |

### `talentAnalysis`（全片模特，不是前 3 秒）

| 字段 | 说明 |
|------|------|
| `count` | 几位、是否同一人；无出镜写「【无出镜模特】」 |
| `appearance` | 性别年龄气质脸型发色妆容体态 |
| `expressionStyle` | 全片表情与镜头关系 |
| `blocking` | 站位、走位、面对镜头/侧身 |

### `wardrobeAnalysis`（全片服装）

| 字段 | 说明 |
|------|------|
| `garments` | 上装下装鞋包配饰，颜色面料版型 |
| `changes` | 换装按时码；未换写「全片同一套」 |
| `stylingNotes` | 层次、露出、复刻要点 |

### 分镜行 `storyboardTable[]`

| 字段 | 类型 | 说明 |
|------|------|------|
| `shotNo` | number | 从 1 递增 |
| `duration` | string | 如 `3s` |
| `shotSize` | string | 景别 |
| `cameraMove` | string | 运镜（可执行术语；禁止空话） |
| `cameraAngle` | string | 镜头角度 |
| `composition` | string | 构图方式 |
| `lightingSetup` | string | 本镜布光；可见光影时禁止「无」 |
| `toneContrast` | string | 本镜影调；可见时禁止「无」 |
| `visualContent` | string | 画面内容 |
| `characterAction` | string | 人物动作 |
| `expression` | string | 表情 |
| `subtitle` | string | 字幕文案 |
| `voiceover` | string | **口播/旁白**；有口播时**必填** |
| `sfx` | string | 音效 |
| `bgm` | string | BGM |
| `transition` | string | 转场 |
| `editRhythm` | string | 剪辑节奏 |

---

## 图片分支 `mediaType: "image"`

### 根字段

| 字段 | 类型 | 约束 |
|------|------|------|
| `mediaType` | string | 固定 `"image"` |
| `action` | string | 固定 `"decompose_complete"` |
| `elements` | object | 画面底层要素 |
| `positivePrompt` | string | 正向生图 Prompt |
| `negativePrompt` | string | 反向负面 Prompt |
| `liveActionReplication` | object | 实拍复刻方案 |

### `elements`

| 字段 | 说明 |
|------|------|
| `subject` | 画面主体 |
| `subjectPose` | 主体姿态 |
| `sceneEnvironment` | 场景环境 |
| `spatialPerspective` | 空间透视 |
| `composition` | 构图方式 |
| `equivalentFocalLength` | 等效焦距 |
| `shootingAngle` | 拍摄角度 |
| `lighting` | 布光对象（见下） |
| `materialTexture` | 材质质感 |
| `colorSystem` | 色彩体系 |
| `atmosphere` | 画面氛围 |
| `detailNotes` | 细节瑕疵/修饰点 |

### `elements.lighting`

| 字段 | 说明 |
|------|------|
| `keyLight` | 主光 |
| `fillLight` | 辅光 |
| `rimLight` | 轮廓光 |
| `ambientLight` | 环境光 |
| `direction` | 光源方向 |
| `hardSoft` | 软硬 |
| `colorTemperature` | 色温 |

### `liveActionReplication`

| 字段 | 说明 |
|------|------|
| `cameraPlacement` | 机位摆放 |
| `lightingSetup` | 灯光布置 |
| `props` | 道具搭配 |
| `cameraParams` | 相机参数参考 |
