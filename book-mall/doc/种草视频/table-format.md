# 种草视频 · 结构化交付契约（权威）

> **系统只解析 ` ```seed-video ` JSON 围栏。** **禁止** Markdown 分镜表/前言交付；展示由系统根据 JSON 渲染。缺围栏或校验失败则无法点选、无法同步。  
> **所有 Skill 共用本契约**（`seed-grass`、`fashion-hit`、`digital-product`、`home-clothes-lounge-wear` 及后续扩展）：不因 Skill 改字段名、step 或枚举 id。

## 硬性规则（每条助手回复必须遵守）

1. 回复**整段**必须为且仅有一个 ` ```seed-video ` 围栏，内含**合法 JSON**（无注释、无尾逗号）。
2. JSON 必须含 **`step`** 与 **`action`**，对应当前 workflow 步骤。
3. 凡结构化数据（脚本、成片参数、逐镜表）**只写在 JSON**；禁止仅靠 Markdown 表格让系统猜结构。
4. 固定枚举字段**禁止改名、禁止缺项**（见下表）。
5. 每步**只输出当前步**字段；未涉及的键不要写。
6. 用户界面隐藏围栏并由 JSON 渲染可读内容；**勿向用户解释 JSON**。

## 回复结构

```
```seed-video
{ ... }
```
```

---

## 全局枚举

| 键 | 允许值 |
|----|--------|
| `step` | `scripts` · `mode` · `style` · `directPlan` · `storyboard` · `formalShots` |
| `action` | `await_script_choice` · `await_mode_choice` · `await_style_choice` · `await_direct_plan_confirm` · `await_storyboard_review` · `await_formal_shots_confirm` |

### 脚本三套（Step2）

| 字段 | 约束 |
|------|------|
| `scripts` | **数组长度必须 = 3** |
| `scripts[n].id` | 依次为 `script-1` · `script-2` · `script-3` |
| `scripts[n].label` | 依次为 `脚本一` · `脚本二` · `脚本三` |
| `scripts[n].title` | 切入角度短标题（**不含** label 前缀） |
| `scripts[n].summary` | 点选卡片说明（建议首句口播） |
| `scripts[n].rows[]` | 至少 1 行；见下 |

### 分镜行 `scripts[].rows[]`（Step2）

| 字段 | 类型 | 说明 |
|------|------|------|
| `beatIndex` | number | 从 1 递增 |
| `duration` | string | 如 `5s` 或 `0-5s` |
| `refImageLabel` | string | 如 `@图片1` |
| `sceneDescription` | string | 画面/运镜说明 |
| `voiceover` | string | 口播 |

### 素材解析 `materialAnalysis`（与 Step2 同轮输出）

| 字段 | 说明 |
|------|------|
| `productSummary` | 商品概述 |
| `sellingPoints` | string[] |
| `sceneTags` | string[] |
| `styleTone` | 风格定位 |
| `materials` | `{ ref, description }[]` 逐图说明 |

---

## 表 A / 表 B（方案① / 方案② · JSON 字段）

同步与展示**均以 JSON 为准**（系统渲染表格）。

### 表 A 镜头序列 `shotSequence[]`

| 字段 | 说明 |
|------|------|
| `index` | 镜号 |
| `timeSlice` | 如 `0-5s` |
| `refImageLabel` | 参考素材 |
| `sceneDescription` | 画面设计 |
| `voiceover` | 口播 |
| `videoPrompt` | 方案②正式脚本必填（AI 视频生成提示词） |
| `durationSec` | 可选 |

### 表 B 成片参数 `configTable`（7 行对象，键名固定）

| 键 | 含义 |
|----|------|
| `globalPrompt` | 全局 AI 生成提示词 |
| `fullVoiceover` | 完整口播 |
| `voiceTone` | 配音音色 |
| `bgmPreset` | 背景音乐 |
| `durationSec` | 视频时长（数字，秒） |
| `aspectRatio` | 画幅比例 |
| `materialUsage` | 素材运用 |

方案①：`directPlan` 对象含 `shotSequence` + `configTable`。  
方案②正式：`shots` 数组（含 `videoPrompt`）+ `configTable`。

---

## 各步骤 JSON 必填摘要

| 步骤 | step | action | 必填 JSON 字段 | 系统渲染结尾语 |
|------|------|--------|----------------|----------------|
| 素材+三套脚本 | `scripts` | `await_script_choice` | `materialAnalysis` + `scripts`(×3) | 请选择脚本： |
| 制作模式 | `mode` | `await_mode_choice` | `modeOptions`(×2) | 请选择视频制作模式： |
| 成片风格 | `style` | `await_style_choice` | `styleOptions`(×2) | 请选择成片风格： |
| 方案①成片参数 | `directPlan` | `await_direct_plan_confirm` | `directPlan.shotSequence` + `directPlan.configTable` | 请确认成片参数： |
| 方案②分镜执行表 | `storyboard` | `await_storyboard_review` | `shotSequence` | 请确认分镜执行表： |
| 方案②正式脚本 | `formalShots` | `await_formal_shots_confirm` | `shots`(×N) + `configTable` | 请确认逐镜参数表： |

### modeOptions（固定 2 项）

```json
[
  { "id": "direct", "label": "方案①：直接连贯生成视频" },
  { "id": "fine", "label": "方案②：按精细成片流程制作" }
]
```

### styleOptions（固定 2 项）

```json
[
  { "id": "sweet-xhs", "label": "A方案：甜美种草风（小红书）" },
  { "id": "sharp-douyin", "label": "B方案：干练安利风（抖音带货）" }
]
```

---

## Step2 Markdown 展示格式（须与 JSON 一致）

**素材解析**

| 维度 | 内容 |
|------|------|
| … | … |

**脚本标题（固定模板）**

- `## 脚本一：{title}`
- `## 脚本二：{title}`
- `## 脚本三：{title}`

**分镜表（列名固定，禁止别名）**

| 分镜 | 时长 | 画面素材 | 口播文案 |
|------|------|----------|----------|

方案①/②后续步骤表 A 列名：`镜号｜时间｜参考素材｜画面设计｜口播文案`（正式脚本加 `AI视频生成提示词` 列）。
