# Pro2 制作包 × 专业拉片 · 整合设计（schema v3）

> **状态**：草案 · 待评审（2026-09-02）  
> **范围**：`pro2-production-script` schema v3 · `film-pull` → Hub 导入 · Hub / 电商拉片 UI  
> **关联**：[Pro2剧本结构化.md](./Pro2剧本结构化.md) · [book-mall/doc/拉片/integration.md](../book-mall/doc/拉片/integration.md) · [25-canvas-pro2-script-structured-output.md](../book-mall/doc/product/25-canvas-pro2-script-structured-output.md)

---

## 1. 整合目标

| 目标 | 说明 |
|------|------|
| **一个下游真源** | Hub / spawn / Gateway 只认 `pro2-production-script`；`film-pull` 为上游分析格式 |
| **导演表 + 工业扩展** | 日常编辑 10～12 列；拉片 25 维进 `shot.analysis`，默认折叠 |
| **Prompt 统一 Pass2** | Pass1 只存事实；`frameImagePrompt` / `videoPrompt` 仅 Pass2 写入 |
| **来源分档校验** | `meta.source=creative` 保留短剧规则；`film_pull` 跟原片时间轴 |

---

## 2. schema v3 变更摘要

- `schemaVersion`: **3**（v2 只读兼容；v3 新增字段均可选）
- `meta.source`: `"creative" | "film_pull" | "adaptation"`（默认 `creative`）
- `meta` 扩展：拉片全片 meta + 三块长文 + `shootingPrep`
- `shots[]` 扩展：`timing` · `cut` · `cinematography` · `blocking` · `narrative` · `analysisDraftPrompt`
- **不删除** v2 字段；Hub 仍用 `shotSize` / `cameraMove` / `sceneDescription` 等导演表列

### 2.1 顶层 `meta`

```typescript
type Pro2ProductionScriptMetaV3 = {
  title?: string;
  synopsis?: string;
  /** 新增 · 默认 creative */
  source?: "creative" | "film_pull" | "adaptation";
  /** 拉片导入 · 原片总时长（秒） */
  totalDurationSec?: number;
  /** 拉片 meta 映射 · 创作时可空 */
  editRhythmCurve?: string;
  shotSequenceLogic?: string;
  cameraLanguageSummary?: string;
  audioDesignLogic?: string;
  /** 拉片三块总结长文 · 人读，不参与 spawn */
  narrativeLogic?: string;
  beatPoints?: string;
  replicableShootingScript?: string;
  /** 拉片 shootingPrep · 导入后可升格为 scenes/props */
  shootingPrep?: {
    venue: string;
    costume: string;
    props: string;
    equipment: string;
  };
};
```

### 2.2 `visualStyle`（不变 + 映射增强）

v2 字段保留。拉片导入时：

| FilmPull | Pro2 visualStyle |
|----------|------------------|
| `meta.artStyle` | `pictureStyle` + `styleAnchor` |
| `meta.cameraLanguageSummary` | `cinematography` |
| `renderGlobalConfig.globalLighting` | `lighting` |
| `renderGlobalConfig.globalVisualTone` | `globalColorTone` |

创作链路仍要求 `dayPalette` / `nightPalette` HEX；拉片导入时可为空，Pass2 / 人工补全。

### 2.3 `shots[]` · 导演表（v2 保留 · 全员可见）

| 字段 | 类型 | UI 列名 | Pass1 | 说明 |
|------|------|---------|-------|------|
| `index` | number | 镜号 | 必填 | 从 1 连续 |
| `shotSize` | string | 景别 | 必填 | 特写/中景/全景… |
| `lighting` | string | 光影 | 必填 | 环境+色温+情绪；须含 scene 名（多场景时） |
| `cameraMove` | string | 运镜 | 必填 | ≥12 字；机位状态+方向+速度+目的 |
| `sceneDescription` | string | 画面描述 | 必填 | 【起始】→【结束】，≥30 字 |
| `propIds` | string[] | 道具 | 可选 | 引用 `props[].id` |
| `dialogue` | string | 对白 | 必填 | 「角色（情绪）："台词"」；无则「—」 |
| `durationSec` | number | 时长(秒) | 必填 | creative：10–15 整数；film_pull：跟原片 |
| `sfxNote` | string | 音效 | 必填 | 环境音/拟音 |
| `audioNote` | string | 口型/配音 | 必填 | BGM dB、同期/OS |
| `sceneId` | string | （关联） | pro 必填 | 引用 `scenes[].id` |
| `characterIds` | string[] | （关联） | 可选 | 引用 `characters[].id` |

Pass1 **禁止**：`imagePrompt` · `videoPrompt` · `frameImagePrompt`。

Pass2 **允许**：`frameImagePrompt` · `videoPrompt`（金标准模板）。

### 2.4 `shots[]` · 拉片扩展 `analysis`（可选 · 默认折叠）

```typescript
type Pro2ShotAnalysisV3 = {
  /** 真实时间码 · film_pull 必填 */
  timing?: {
    startTimeSec: number;
    endTimeSec: number;
  };
  /** 转场 · film_pull 非末镜 cut.detail 禁止「无」 */
  cut?: {
    transition: string;   // 硬切/叠化/闪白
    detail: string;       // 动作切点、与下一镜衔接
  };
  /** 摄影细分 · 不再塞进 cameraMove */
  cinematography?: {
    cameraAngle: string;       // 侧平视/俯拍…
    focalLength: string;       // 标准50mm…
    composition: string;       // 构图描述
  };
  /** 调度 · sceneDescription 只保留叙事摘要 */
  blocking?: {
    subjectBlocking: string;
    sightDirection: string;
    foreMidBackLayer: string;
    sceneEnvironment: string;  // 本镜可见环境
    dynamicProps: string;      // 本镜道具
  };
  /** 光影细分（导入时合并进 lighting，此处保留原值） */
  look?: {
    lightingSetup: string;
    toneContrast: string;
  };
  /** 叙事/节奏 */
  narrative?: {
    function: string;          // narrativeFunction
    rhythmWeight: string;      // 铺垫/爆发/收束
    visualMetaphor?: string;   // 允许「无」
  };
  /** 拉片 audioInfo 原结构 · 导入后拆到 dialogue/sfx/audioNote */
  audioInfo?: {
    scriptSubtitle: string;
    vocalEmotion: string;
    ambientSound: string;
    fxAndBgm: string;
  };
  /** 拉片 aiVisualPrompt · 中间草稿，非最终 Prompt */
  analysisDraftPrompt?: string;
};
```

`shots[]` 形态：

```typescript
{
  index: 1,
  shotSize: "中景",
  lighting: "...",
  cameraMove: "...",
  sceneDescription: "...",
  // ... 导演表字段
  analysis?: Pro2ShotAnalysisV3;  // v3 新增
}
```

### 2.5 资产块（`characters` / `scenes` / `props`）

**仍以 Pro2 为准**，拉片不另建平行结构。

| 来源 | 策略 |
|------|------|
| 文字创作 Pass1 | LLM 直接输出辞典 + id |
| 拉片导入 | Phase 1：可为空；Phase 3：从 `shootingPrep` + `blocking.sceneEnvironment` + `dynamicProps` **提议**辞典，用户确认写入 |

---

## 3. 校验分档

### 3.1 `meta.source = creative`（默认）

与 v2 相同：

- 12–18 镜
- `durationSec` 之和 175–185 秒
- 每镜 10–15 秒整数
- `cameraMove` ≥12 字
- Pass1 无 `frameImagePrompt` / `videoPrompt`

### 3.2 `meta.source = film_pull`

| 规则 | 要求 |
|------|------|
| 镜数 | 跟原片，无 12–18 限制 |
| 时长 | `shots[].durationSec` 之和 ≈ `meta.totalDurationSec`（±0.5s） |
| 时间轴 | 每镜 `analysis.timing` 连续；末镜 `endTimeSec` = `totalDurationSec` |
| 切点 | 非末镜 `analysis.cut.detail` 禁止「无」 |
| 场景 | 超过半数镜 `blocking.sceneEnvironment` 非「无」 |
| Pass1 Prompt | 禁止 `frameImagePrompt` / `videoPrompt`；允许 `analysisDraftPrompt` |
| 资产 | `scenes[]` / `characters[]` 可为空（导入初期） |

---

## 4. Adapter 映射表（film-pull → pro2 v3）

实现文件：`book-mall/lib/ecom/adapters/ecom-film-pull-to-pro2-script.ts`（待重写）

### 4.1 顶层

| FilmPull 字段 | Pro2 v3 字段 | 规则 |
|---------------|--------------|------|
| — | `schemaVersion` | `3` |
| — | `meta.source` | `"film_pull"` |
| `meta.narrativeMainLine` | `meta.synopsis` | 直传 |
| `meta.totalDurationSec` | `meta.totalDurationSec` | 直传 |
| `meta.editRhythmCurve` | `meta.editRhythmCurve` | 直传 |
| `meta.shotSequenceLogic` | `meta.shotSequenceLogic` | 直传 |
| `meta.cameraLanguageSummary` | `meta.cameraLanguageSummary` + `visualStyle.cinematography` | 双写 |
| `meta.audioDesignLogic` | `meta.audioDesignLogic` | 直传 |
| `meta.artStyle` | `visualStyle.pictureStyle` + `styleAnchor` | 直传 |
| `shootingPrep` | `meta.shootingPrep` | 直传 |
| `narrativeLogic` | `meta.narrativeLogic` | 直传 |
| `beatPoints` | `meta.beatPoints` | 直传 |
| `replicableShootingScript` | `meta.replicableShootingScript` | 直传 |
| `renderGlobalConfig.*` | `visualStyle.lighting` / `globalColorTone` | 见 §2.2 |

### 4.2 镜级 · 导演表（主表列）

| FilmPull 字段 | Pro2 v3 字段 | 转换规则 |
|---------------|--------------|----------|
| `shotNo` | `index` | 直传 |
| `shotScale` | `shotSize` | 直传 |
| `cameraMovement` | `cameraMove` | 若 <12 字，前缀补「固定机位，」+ 原值 + 「，保持镜头稳定」 |
| `lightingSetup` + `toneContrast` + `sceneEnvironment` | `lighting` | `「{sceneEnvironment}，{lightingSetup}，{toneContrast}」` 去「无」 |
| `subjectBlocking` + `sightDirection` | `sceneDescription` | `【起始】{subjectBlocking}，视线{sightDirection}。【结束】继承上一动作收束`；若 blocking 够长则 LLM 润色 Pass 可选 |
| `audioInfo.scriptSubtitle` | `dialogue` | 若为口播且能识别说话人 → Pro2 格式；否则暂写「—」，原文留 `analysis.audioInfo` |
| `durationSec` | `durationSec` | `Math.round` 或保留小数（film_pull 允许小数，Hub 展示 1 位） |
| `audioInfo.ambientSound` | `sfxNote` | 非「无」则直传，否则「—」 |
| `audioInfo.fxAndBgm` + `vocalEmotion` | `audioNote` | 合并：`情绪：{vocalEmotion}；{fxAndBgm}` |
| — | `propIds` | Phase 1 空；Phase 3 从 `dynamicProps` 匹配 `props[]` |
| — | `sceneId` / `characterIds` | Phase 1 空；Phase 3 辞典升格后回填 |

### 4.3 镜级 · `analysis` 扩展（完整保留）

| FilmPull 字段 | Pro2 `analysis` 路径 |
|---------------|----------------------|
| `startTimeSec` / `endTimeSec` | `timing.startTimeSec` / `timing.endTimeSec` |
| `cutTransition` | `cut.transition` |
| `cutDetail` | `cut.detail` |
| `cameraAngle` | `cinematography.cameraAngle` |
| `focalLengthPerspective` | `cinematography.focalLength` |
| `composition` | `cinematography.composition` |
| `subjectBlocking` | `blocking.subjectBlocking` |
| `sightDirection` | `blocking.sightDirection` |
| `foreMidBackLayer` | `blocking.foreMidBackLayer` |
| `sceneEnvironment` | `blocking.sceneEnvironment` |
| `dynamicProps` | `blocking.dynamicProps` |
| `lightingSetup` | `look.lightingSetup` |
| `toneContrast` | `look.toneContrast` |
| `narrativeFunction` | `narrative.function` |
| `rhythmWeight` | `narrative.rhythmWeight` |
| `visualMetaphor` | `narrative.visualMetaphor` |
| `audioInfo` | `audioInfo`（整对象保留） |
| `aiVisualPrompt` | `analysisDraftPrompt`（**不**写 `videoPrompt` / `frameImagePrompt`） |

### 4.4 禁止项（相对现 adapter）

| 现行为 | v3 目标 |
|--------|---------|
| `aiVisualPrompt` → `videoPrompt` + `frameImagePrompt` | **禁止**；只进 `analysis.analysisDraftPrompt` |
| `characters/scenes/props` 全空且不计划补 | Phase 1 可空；文档标明临时态 |
| 丢弃 cutDetail / 时间码 / 机位焦段 | **禁止**；全部进 `analysis` |

---

## 5. Hub 列展示方案

### 5.1 「生成分镜」弹表 · 主表（导演表 12 列）

与 v2 Pass1 一致，所有人默认看到：

| # | 列名 | 字段 | 宽度建议 |
|---|------|------|----------|
| 1 | 镜号 | `index` | 48px |
| 2 | 时段 | `analysis.timing` | 96px · 仅 `source=film_pull` 显示 |
| 3 | 景别 | `shotSize` | 72px |
| 4 | 光影 | `lighting` | 120px |
| 5 | 运镜 | `cameraMove` | 120px |
| 6 | 画面描述 | `sceneDescription` | 240px · multiline |
| 7 | 道具 | `propIds` → 名称 | 80px |
| 8 | 对白 | `dialogue` | 160px |
| 9 | 时长 | `durationSec` | 56px |
| 10 | 音效 | `sfxNote` | 100px |
| 11 | 口型/配音 | `audioNote` | 100px |
| 12 | 关联场景 | `sceneId` → 名称 | 80px |

Pass2 追加列（用户点「生成提示词」后）：

| # | 列名 | 字段 |
|---|------|------|
| 13 | 分镜图 Prompt | `frameImagePrompt` |
| 14 | 分镜视频 Prompt | `videoPrompt` |

### 5.2 「拉片详情」折叠面板（每镜 expandable）

**触发**：`meta.source === "film_pull"` 或任意镜 `analysis` 非空。

**Tab A · 剪辑**

| 标签 | 字段 |
|------|------|
| 转场 | `analysis.cut.transition` |
| 切点说明 | `analysis.cut.detail` |
| 节奏权重 | `analysis.narrative.rhythmWeight` |
| 叙事功能 | `analysis.narrative.function` |

**Tab B · 摄影**

| 标签 | 字段 |
|------|------|
| 机位 | `analysis.cinematography.cameraAngle` |
| 焦距透视 | `analysis.cinematography.focalLength` |
| 构图 | `analysis.cinematography.composition` |
| 视线 | `analysis.blocking.sightDirection` |
| 前中后景 | `analysis.blocking.foreMidBackLayer` |

**Tab C · 调度/环境**

| 标签 | 字段 |
|------|------|
| 主体调度 | `analysis.blocking.subjectBlocking` |
| 场景环境 | `analysis.blocking.sceneEnvironment` |
| 本镜道具 | `analysis.blocking.dynamicProps` |
| 布光 | `analysis.look.lightingSetup` |
| 影调 | `analysis.look.toneContrast` |

**Tab D · 音频原稿**（只读参考）

| 标签 | 字段 |
|------|------|
| 口播字幕 | `analysis.audioInfo.scriptSubtitle` |
| 情绪 | `analysis.audioInfo.vocalEmotion` |
| 环境声 | `analysis.audioInfo.ambientSound` |
| BGM/特效 | `analysis.audioInfo.fxAndBgm` |

**Tab E · 分析草稿 Prompt**（只读 · 灰字）

- `analysis.analysisDraftPrompt`
- 脚注：「导入自拉片，须 Pass2 生成正式 Prompt」

### 5.3 Hub JSON 编辑器（`pro2-production-script-editor`）

- 保持现有卡片式编辑
- 每镜卡片底部增加 `<details>拉片扩展字段</details>`，仅 `analysis` 有值时展开
- 不强制在卡片内展示 25 列

### 5.4 电商 · 专业拉片 UI（不改主表）

| 阶段 | 表 | 列 |
|------|-----|-----|
| 拉片结果（只读） | `film-pull-shot-table` | 现有 25 维 + cutDetail · **保持** |
| 制作脚本 | `film-pull-production-script-table` | 现有列 + 导入 Hub 前预览 |
| 导入 Hub 后 | Canvas Hub 弹表 | §5.1 + §5.2 |

拉片侧 **不** 改为 Pro2 12 列；整合发生在 adapter + Hub。

---

## 6. Pass2 提示词补充（拉片来源）

当 `meta.source === "film_pull"` 且用户点「生成提示词」，Pass2 system 追加：

```
输入除导演表外，每镜含 analysis 扩展（时间码、切点、机位、焦段、构图、调度、层次）。
须：
1. frameImagePrompt：单段中文金标准（景别→场景→角色→动作→道具→光影→镜头→氛围→[视觉风格]）
2. videoPrompt：Seedance 多段模板；「前一个分镜描述」须引用上一镜 sceneDescription 或 analysis.cut.detail 衔接
3. 禁止改编 analysis 中的摄影事实（景别/切点/时长）
4. analysisDraftPrompt 仅作参考，不得整段复制为最终 Prompt
```

---

## 7. 实施阶段

### Phase 1（schema + adapter · 无 Hub UI 大改）

- [ ] `pro2-production-script-schema.ts` 增 v3 可选字段 + `meta.source`
- [ ] book-mall mirror 同步
- [ ] 重写 `filmPull*ToPro2ProductionScript` 按 §4 映射
- [ ] 校验：`source=film_pull` 分档逻辑
- [ ] 更新 `book-mall/doc/拉片/integration.md` 映射表
- [ ] 文档：90s 上限、`table-format.md` 中文示例

### Phase 2（Hub UI）

- [ ] 「生成分镜」弹表：时段列 + 拉片详情折叠
- [ ] `pro2-production-script-editor`：analysis `<details>`
- [ ] 导入后自动 `step=storyboard`，**不**预填 Pass2 Prompt

### Phase 3（资产升格 + Pass2）

- [ ] `shootingPrep` → 提议 `scenes[]` / `props[]` 对话框
- [ ] Pass2 prompt 拉片分支
- [ ] 废弃 `assembleFilmPullProductionPlan` 规则拼接作**最终** Prompt（可保留作 analysisDraft 预览）

---

## 8. 兼容与迁移

| 场景 | 行为 |
|------|------|
| 现有 v2 Hub 项目 | 只读兼容；无 `analysis` 时 UI 与现网一致 |
| v2 JSON 写入 | 允许；读取时 `ensurePro2ProductionScriptSchemaVersion` 不强制升 3 |
| 新拉片导入 | 写 v3 + `meta.source=film_pull` |
| 新创作项目 | 可继续 v2 字段集；`meta.source` 默认 `creative` |

---

## 9. 评审检查清单

- [ ] 导演表 12 列是否满足日常编辑（不被 25 列淹没）
- [ ] `analysis` 嵌套深度是否可接受（vs 平铺 25 字段）
- [ ] 拉片导入是否接受初期 `characters/scenes/props` 为空
- [ ] `film_pull` 时长小数 vs Hub 整数展示
- [ ] Pass2 是否在导入后由用户手动触发（不自动 batch）

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-09-02 | 初稿：schema v3 字段 · adapter 映射 · Hub/电商 UI 方案 |
