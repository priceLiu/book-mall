# 拆图拆视频 · 结构化交付契约（权威）

> **系统只解析 ` ```media-decompose ` JSON 围栏。** Markdown 仅供用户阅读，须与 JSON 一致；缺围栏或校验失败则无法渲染结构化结果。

## 硬性规则

1. 回复**最末尾**必须有且仅有一个 ` ```media-decompose ` 围栏，内含**合法 JSON**（无注释、无尾逗号）。
2. JSON 根对象必须含 **`mediaType`**（`image` | `video`）与 **`action`**（固定 `decompose_complete`）。
3. 凡结构化数据**只写在 JSON**；禁止仅靠 Markdown 表格让系统猜结构。
4. 固定字段名**禁止改名、禁止缺项**（见下表）。
5. 按 `mediaType` **只输出对应分支**字段；另一分支键不要写。
6. JSON 内禁止注释；长文用 `\n` 换行。

## 回复结构（固定顺序）

```
[用户可读 Markdown — 表格/段落]

```media-decompose
{ ... }
```
```

---

## 视频分支 `mediaType: "video"`

### 根字段

| 字段 | 类型 | 约束 |
|------|------|------|
| `mediaType` | string | 固定 `"video"` |
| `action` | string | 固定 `"decompose_complete"` |
| `visualStyle` | string | 全片视觉风格/美术（如高饱和多巴胺、低饱和莫兰迪、纪实 handheld） |
| `globalColorTone` | string | 全片色调基调（如暖金侧光、冷青电影感、红蓝高对比） |
| `cameraLanguageSummary` | string | 全片运镜总述（如「镜1横移；镜3慢推；其余固定微手持」） |
| `scenePrep` | object | 场地与固定道具（不含旧服装）；见下 |
| `storyboardTable` | array | **至少 1 镜** |
| `narrativeLogic` | string | 整体叙事逻辑拆解 |
| `beatPoints` | string | 镜头卡点要点 |
| `replicableShootingScript` | string | 可直接落地复刻的同款拍摄脚本 |

### `scenePrep`

| 字段 | 说明 |
|------|------|
| `venue` | 主要拍摄场地/环境 |
| `fixedProps` | 固定道具（不含随换产品/服装） |

### 分镜行 `storyboardTable[]`

Markdown 表列名须对齐：**镜号｜时长｜景别｜运镜｜镜头角度｜构图方式｜布光｜影调｜画面内容｜人物动作｜表情｜字幕文案｜口播文案｜音效｜BGM｜转场｜剪辑节奏**

| 字段 | 类型 | 说明 |
|------|------|------|
| `shotNo` | number | 从 1 递增 |
| `duration` | string | 如 `3s` |
| `shotSize` | string | 景别 |
| `cameraMove` | string | 运镜/相机运动（固定/慢推/横移跟拍/手持微晃等可执行术语；禁止「有运镜」等空话） |
| `cameraAngle` | string | 镜头角度 |
| `composition` | string | 构图方式 |
| `lightingSetup` | string | 本镜布光（方向/软硬/主辅关系）；可见光影时禁止「无」 |
| `toneContrast` | string | 本镜影调/对比/色彩倾向；可见时禁止「无」 |
| `visualContent` | string | 画面内容（主体与场景；光影/影调写入专用列，勿重复堆砌） |
| `characterAction` | string | 人物动作 |
| `expression` | string | 表情 |
| `subtitle` | string | 字幕文案（画面内字幕；可与口播相同） |
| `voiceover` | string | **口播文案**（配音/旁白；有口播时必须填写；若与字幕相同可写同样内容） |
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
| `positivePrompt` | string | 正向生图 Prompt（**必须**体现 elements.lighting + colorSystem + atmosphere） |
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
