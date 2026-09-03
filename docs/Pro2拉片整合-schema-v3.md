# Pro2 制作包 × 专业拉片 · 统一规格（schema v3）

> **状态**：实施中（2026-09-02）  
> **范围**：`pro2-production-script` schema v3 · 制作档（简版 / 专业版）· Hub 原生拉片 · 电商 `film-pull` 导入  
> **关联**：[Pro2剧本结构化.md](./Pro2剧本结构化.md) · [book-mall/doc/拉片/integration.md](../book-mall/doc/拉片/integration.md) · [25-canvas-pro2-script-structured-output.md](../book-mall/doc/product/25-canvas-pro2-script-structured-output.md) · [大模型剧本提示词.md](./大模型剧本提示词.md)

---

## 0. 需求（Why）

画布剧本生成与电商专业拉片长期两套契约：导演表偏创作 / 生图，拉片 25 维偏还原 / 剪辑。导入 Hub 时丢掉切点、时间码、机位焦段；拉片制作 Prompt 用字段拼接，无法走 Pass2 金标准。

**目标**：同一份制作包、两档深度、一种下游制作流程。

| 目标 | 说明 |
|------|------|
| **一个下游真源** | Hub / spawn / Gateway 只认 `pro2-production-script` |
| **两档深度** | **简版** `packProfile=director`（现网导演表）；**专业版** `packProfile=industrial`（导演表 + `analysis`） |
| **题材正交** | Dock 右上角题材芯片（古风 / 默认 / 自定义）**不**表示结构深度 |
| **Hub 原生拉片** | 专业版 + 上游视频 + Dock「拉片」→ 直接写入 Hub，不再「建电商项目 → 导入」 |
| **Pass2 统一** | Pass1 只存事实；`frameImagePrompt` / `videoPrompt` 仅 Pass2 |
| **校验分档** | 提示词约束 + Zod/语义校验 + LLM 最多 5 次重试；禁止用「无」灌满当成功 |

### 0.1 用户路径

```
选题材（古风 / 默认 / 自定义） + 选制作档（简版 / 专业版）
  ├─ 简版：主题 / 剧本 → 现网 Pass1 → 导演表 → Pass2 → 创建分镜
  └─ 专业版
        ├─ 无视频：文字精细分镜（含 analysis）
        └─ 左侧 + 视频（上传 / 粘贴 / 拖入）+ 输入「拉片」
              → source=film_pull → 跟原片写 analysis → 同一套制作
```

简版用户输入「拉片」且上游有视频：**拦截**，提示改专业版。

### 0.2 合并的历史缺口

| 缺口 | 处理 |
|------|------|
| 文档写 ≤60s、代码 90s | 统一 **90s**（`FILM_PULL_V1_MAX_SEC`） |
| adapter 只映射 8 字段 | 导演表 + 完整 `analysis` |
| `aiVisualPrompt` 双写最终 Prompt | 只进 `analysis.analysisDraftPrompt` |
| `大模型剧本提示词.md` 仍要求 GFM | 运行时 **JSON-only v13**；GFM 仅人读渲染 |
| 金标准范例缺角色名 / 道具名 | 提示词 pack 用完整结构，不依赖残缺 few-shot 当唯一真源 |
| 拉片制作脚本规则拼接 | 电商可作预览；Hub 最终 Prompt 必须 Pass2 |

---

## 1. 产品决策

- **结构只做一份**：导演表 + 可选 `shots[].analysis`。简版不另起 JSON。
- **不要复用** `tier: standard\|pro\|fine`（画布已写死 `tier=pro`）。深度用 `meta.packProfile`。
- **拉片只挂专业版**。视频节点只负责媒体；控制面在剧本 Dock。
- **提示词不硬编码在组件**：走 pack 常量 / Hub prompt 字段。
- 电商 25 列表 = `analysis` 的展开视图，不改成 Hub 12 列。

---

## 2. schema v3

- `schemaVersion`: **3**（v1/v2 只读兼容；v3 新增字段均可选）
- `meta.packProfile`: `"director" | "industrial"`（默认 `director`）
- `meta.source`: `"creative" | "film_pull"`（默认 `creative`）
- `shots[].analysis`：工业扩展块

### 2.1 `meta`

```typescript
type Pro2ProductionScriptMetaV3 = {
  title?: string;
  synopsis?: string;
  packProfile?: "director" | "industrial";
  source?: "creative" | "film_pull";
  totalDurationSec?: number;
  editRhythmCurve?: string;
  shotSequenceLogic?: string;
  cameraLanguageSummary?: string;
  audioDesignLogic?: string;
  narrativeLogic?: string;
  beatPoints?: string;
  replicableShootingScript?: string;
  shootingPrep?: {
    venue: string;
    costume: string;
    props: string;
    equipment: string;
  };
};
```

### 2.2 `visualStyle`

v2 字段保留。拉片 / 专业版导入：

| 来源 | Pro2 visualStyle |
|------|------------------|
| 拉片 `meta.artStyle` | `pictureStyle` + `styleAnchor` |
| `meta.cameraLanguageSummary` | `cinematography` |
| `renderGlobalConfig.globalLighting` | `lighting` |
| `renderGlobalConfig.globalVisualTone` | `globalColorTone` |

创作简版仍要求日/夜色板 HEX（现网）；`film_pull` 可空，Pass2 / 人工补全。

### 2.3 `shots[]` · 导演表（全员可见）

| 字段 | UI 列名 | Pass1 |
|------|---------|-------|
| `index` | 镜号 | 必填 |
| `shotSize` | 景别 | 必填 |
| `lighting` | 光影 | 必填 |
| `cameraMove` | 运镜 | 必填 · ≥12 字 |
| `sceneDescription` | 画面描述 | 必填 · 【起始】→【结束】 |
| `propIds` | 道具 | 可选 |
| `dialogue` | 对白 | 必填 · 「角色（情绪）："台词"」 |
| `durationSec` | 时长 | 必填 |
| `sfxNote` | 音效 | 必填 |
| `audioNote` | 口型/配音 | 必填 |
| `sceneId` | 关联场景 | creative pro 必填；film_pull 初期可空 |
| `characterIds` | 关联角色 | 可选 |

Pass1 **禁止** `imagePrompt` / `videoPrompt` / `frameImagePrompt`。  
Pass2 **允许** `frameImagePrompt` / `videoPrompt`。

### 2.4 `shots[].analysis`

```typescript
type Pro2ShotAnalysisV3 = {
  timing?: { startTimeSec: number; endTimeSec: number };
  cut?: { transition: string; detail: string };
  cinematography?: { cameraAngle: string; focalLength: string; composition: string };
  blocking?: {
    subjectBlocking: string;
    sightDirection: string;
    foreMidBackLayer: string;
    sceneEnvironment: string;
    dynamicProps: string;
  };
  look?: { lightingSetup: string; toneContrast: string };
  narrative?: { function: string; rhythmWeight: string; visualMetaphor?: string };
  audioInfo?: {
    scriptSubtitle: string;
    vocalEmotion: string;
    ambientSound: string;
    fxAndBgm: string;
  };
  analysisDraftPrompt?: string;
};
```

### 2.5 资产块

| 来源 | 策略 |
|------|------|
| 文字 Pass1 | LLM 输出 `characters` / `scenes` / `props` + id |
| 拉片 | 初期可空；后续可由 `shootingPrep` 升格 |

---

## 3. 校验分档

| 档 | 规则 |
|----|------|
| director + creative | 现网 v2：12–18 镜、175–185s、每镜 10–15s、Pass1 禁最终 Prompt |
| industrial + creative | 上表 + 每镜 `analysis` 核心块非空（cut / cinematography / blocking） |
| industrial + film_pull | **不**套 12–18 / 3 分钟；时间轴连续；非末镜 `cut.detail` 禁「无」；半数以上 `sceneEnvironment` 有内容；只允许 `analysisDraftPrompt` |

校验失败 → 现有 Gateway 路径最多 **5 次重试**；仍失败则任务失败、不计积分。  
**禁止**把空 `analysis` coerce 成「无」后当成功。

---

## 4. 提示词（pack，非组件硬编码）

| 常量 | 用途 |
|------|------|
| `STORY_PRO2_PACK_PROFILE_DIRECTOR_RULES` | 简版：现网导演表契约 |
| `STORY_PRO2_PACK_PROFILE_INDUSTRIAL_RULES` | 专业版：analysis 规范 + 禁最终 Prompt |
| `STORY_PRO2_FILM_PULL_INPUT_RULES` | 跟片、硬切=一镜、禁止脑补 |

题材 pack（古风 / 默认 / 自定义）**叠加**制作档规则。  
Pass2 在 industrial 时必须吃 `analysis`，禁止整段复制 `analysisDraftPrompt`。

电商 analyze **直出** `pro2-production-script` v3（`meta.source=film_pull`）；25 列 UI 为 `shots[].analysis` 投影；legacy v1 `film-pull` 只读兼容。导入 / Hub 真源只认 v3。

---

## 5. Adapter（film-pull → pro2 v3）

实现：`book-mall/lib/ecom/adapters/ecom-film-pull-to-pro2-script.ts`

- `schemaVersion=3`，`packProfile=industrial`，`source=film_pull`
- 顶层 meta / shootingPrep / 三块长文完整映射
- 导演表由 blocking / 光影 / 口播拆出
- 25 维进 `analysis`；`aiVisualPrompt` **只**进 `analysisDraftPrompt`

---

## 6. Hub UI

### 6.1 Dock

- 题材芯片：**不变**
- 旁增 **制作档** 芯片：简版 / 专业版 → `hub.packProfile`
- 默认简版
- Placeholder：专业版且有上游视频时提示「输入拉片，或补充要求后发送」

### 6.2 发送

| 条件 | 行为 |
|------|------|
| 简版 | 现网 full_pack |
| 专业版 · 无视频 | full_pack + industrial 规则 |
| 专业版 · 上游视频 · Dock 含「拉片」（或仅视频无大纲） | `source=film_pull`，Hub LLM + `video_url` |
| 简版 · 拉片意图 · 有视频 | **拦截**，提示改专业版 |

### 6.3 分镜表

主表 12 列导演表；`industrial` 或存在 `analysis` 时：时段列 + 每镜折叠「拉片详情」（剪辑 / 摄影 / 调度 / 音频 / 草稿 Prompt）。

### 6.4 视频节点

Hub 左侧 + 已有「视频」。`FilmPullVideoDock` **不再**作为拉片控制台：引导到剧本 Dock 选专业版后发送。

---

## 7. 验收（最后结果）

### 7.1 用户

1. Dock 可独立选题材与制作档。
2. 简版生成结果与现网导演表兼容，无强制 25 列。
3. 专业版文字生成含可展开 `analysis`。
4. 专业版 + 上传视频 +「拉片」→ Hub 写入制作包，可继续「生成提示词 / 创建分镜」。
5. 简版输入拉片被拦截。
6. 电商 25 列表仍可用；导出 Hub 不丢切点 / 时间码。

### 7.2 机器

- 无围栏 / 残缺 JSON / industrial 缺 analysis → 校验失败并重试
- `film_pull` 不套 12–18 镜
- adapter 单测：`cutDetail`、时间码、机位、焦段进入 `analysis`；无 `videoPrompt` 预填
- 文档与代码时长均为 **90s**

---

## 8. 管理后台待处理

`SP-200`～`SP-212`，见 `book-mall/scripts/seed-admin-pending-features.ts`，`docPath` 为本文件。

---

## 9. 兼容

| 场景 | 行为 |
|------|------|
| 现有 v2 Hub | 只读兼容；无 `analysis` 时 UI 与现网一致 |
| 缺 `packProfile` | 视为 `director` |
| 新拉片 / 专业版生成 | 写 v3 |

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-09-02 | 初稿：字段 / adapter / Hub 列 |
| 2026-09-02 | 定稿：两档 `packProfile`、Hub 原生拉片、文档缺口合并、验收与 SP-200 任务 |
