# 画布剧本结构化输出（Pro2）· 需求真源

> **状态**：已实施（2026-08-19）  
> **范围**：影视专业版 2.0（`story-pro2`）· `story-pro2-starter` / `story-pro2-script-hub` / 剧组公告栏  
> **非范围**：Story-Pro 1.0、分镜视频 1.0（sbv1）、电商跨站 adapter、Prisma 新表  
> **关联**：[story-pro2-workflow-canonical.md](../../../canvas-web/docs/story-pro2-workflow-canonical.md) · [pro2-production-pack-standard.ts](../../../canvas-web/lib/canvas/data/pro2-production-pack-standard.ts) · 金标准 [docs/result.md](../../../docs/result.md)

---

## 1. 背景与目标

Pro2 制作包 v7 以 **GFM Markdown 表** 为 LLM 返回契约，程序经 `parse-md-tables` 解析后写入 Hub 与公告栏。表头字面依赖强，模型稍改列名即导致下游 spawn 失败。

**目标**：固定 **JSON 胖结构** 为机器可读真源；LLM 回复末尾附 ` ```pro2-production-script ` 围栏；Zod 校验通过后 merge 至 Hub；**Markdown 由 JSON 渲染**供人读，并保留 **无围栏时 MD 回退**。

**输入不变**：上传剧本、参考图、Skill/类别创意正文、Gateway `messages` 形态均不改。

---

## 2. 交付机制

```
[可选 · 人读 Markdown 六章节]

```pro2-production-script
{ "schemaVersion": 1, "tier": "pro", "step": "...", "patch": { ... } }
```
```

| 规则 | 说明 |
|------|------|
| 围栏语言标记 | 必须为 `pro2-production-script` |
| 机器可读源 | **仅 JSON**；缺围栏或 Zod 失败 → 走 legacy MD 解析 |
| step | `full_pack` · `outline` · `character` · `scene` · `storyboard` |
| tier | `standard` · `pro` · `fine`（控制必填字段） |

实现：`canvas-web/lib/canvas/pro2-production-script-structured.ts` · `pro2-production-script-schema.ts`

---

## 3. 胖结构 `Pro2ProductionScript`（schemaVersion: 1）

### 3.1 顶层块

| 块 | 说明 | 对应 v7 Markdown 章节 |
|----|------|----------------------|
| `meta` | 片名、梗概 | — |
| `visualStyle` | 视觉风格总纲 | `## 视觉风格总纲` |
| `coreConflict` | 核心冲突与结构 | `## 核心冲突与结构摘要` |
| `scenes` | 场景视觉辞典 | `## 场景视觉辞典` |
| `characters` | 角色视觉辞典 | `## 角色视觉辞典` |
| `shots` | 分镜脚本 | `## 分镜脚本` |
| `handoff` | 交接清单 | `## 下一步交接清单` |
| `props` / `moods` / `audios` | 工业化扩展 | script-studio / 公告栏（可空） |

Hub 节点字段：`productionScript?: Pro2ProductionScript`（与 `outlineMd` 等并存，JSON 优先写入）。

### 3.2 `visualStyle`

| 字段 | 说明 | v7 维度 |
|------|------|---------|
| `worldBackground` | **故事背景 / 世界观**（新增必填 · pro 档） | 新增行 |
| `era` | 年代/环境定位 | 年代/环境定位 |
| `globalColorTone` | 全剧色调基调 | 全剧色调基调 |
| `pictureStyle` | 画面风格 | 画面风格 |
| `cinematography` | 摄影风格 | 摄影风格 |
| `dayPalette` | 日景色板 `{ primary, highlight, shadow }` | 日景调色板 |
| `nightPalette` | 夜景色板 | 夜景调色板 |
| `skinMaterial` | 皮肤/材质 | 皮肤/材质基调 |
| `setDesign` | 置景 | 建筑风格/置景 |
| `lighting` | 全片光影基调 | 光影基调 |
| `styleAnchor` | 风格锚定 | 英文风格锚定 |

### 3.3 `scenes[]`

| 字段 | GFM 列 |
|------|--------|
| `id`, `name` | 场景名 |
| `environmentTimeMood` | 环境/时间/气氛 |
| `imagePrompt` | 生图关键词(英文) |
| `negativePrompt` | 固定反向提示词 |
| `colorBlock?` | `{ primary, secondary?, highlight?, shadow?, notes? }` |

### 3.4 `characters[]`

| 字段 | GFM 列 |
|------|--------|
| `id`, `name` | 姓名 |
| `role` | 身份 |
| `appearance` | 外貌/服装/标志性动作 |
| `personality` | 性格 |
| `imagePrompt` | AI生图提示词(英文) |

### 3.5 `shots[]`（核心）

| 字段 | GFM 列 |
|------|--------|
| `index` | 镜号 |
| `shotSize` | 景别 |
| `cameraMove` | 运镜 |
| `sceneDescription` | 画面描述（含起始→终止站位） |
| `dialogue` | 对白 |
| `durationSec` | 时长(秒) |
| `imagePrompt` | AI生图提示词(英文) |
| `videoPrompt` | AI视频提示词(英文) |
| `audioNote` | 口型/配音备注 |
| `sceneId?`, `characterIds?` | 关联 |
| `colorBlock?` | 分镜环境色（fine 档可选 override） |
| `lighting?` | 分镜光影（fine 档结构化） |

映射 Hub 行：`StoryProFrameRow.shotSize` / `cameraMove` / `description` / `dialogue` / `durationSec` / `aiImagePrompt` / `videoPrompt`。

### 3.6 `handoff[]`

| 字段 | GFM 列 |
|------|--------|
| `index` | 序号 |
| `item` | 交接项 |
| `owner` | 负责方 |
| `note` | 备注 |

---

## 4. 瘦 patch `Pro2ProductionScriptPatch`

```json
{
  "schemaVersion": 1,
  "tier": "pro",
  "step": "full_pack",
  "patch": {
    "visualStyle": { ... },
    "shots": [ ... ]
  }
}
```

| step | patch 允许块 |
|------|----------------|
| `full_pack` | 全部六章 + handoff |
| `outline` | visualStyle, coreConflict, scenes, handoff（场景辞典可含） |
| `character` | characters |
| `scene` | scenes |
| `storyboard` | shots |

---

## 5. 三档 profile

| tier | 必填 |
|------|------|
| `standard` | shots: index, sceneDescription, dialogue, imagePrompt 或 videoPrompt |
| `pro` | + visualStyle.worldBackground/era；shots 九列全填；scenes/characters 表完整 |
| `fine` | + scenes/shots.colorBlock；shots.lighting 结构化 |

默认 Pro2 Hub：**pro**。

---

## 6. Apply 与下游

1. `extractPro2ProductionScriptPatch(textOutput)` → Zod  
2. `mergeProductionScriptPatch` → `productionScript`  
3. `renderProductionScriptMarkdown` → `outlineMd` / `characterMd` / `sceneMd` / `storyboardMd`  
4. `productionScriptToHubRows` → `scriptStudio*Rows`  
5. `buildCrewBulletinFromHub` — 逻辑不变  

无有效围栏 → `applyHubSectionFromTask` 走现有 MD 路径。

---

## 7. 验收标准

- [ ] Pro2 LLM prompt 含 JSON 围栏契约，不含「不要 JSON」  
- [ ] 有效围栏经 Zod 写入 Hub `productionScript` 与 `*Md`  
- [ ] `StoryProFrameRow` 含景别/运镜/画面描述/时长/双提示词  
- [ ] 发布剧本后公告栏含 script/character/scene/frame/frameVideo 任务  
- [ ] 无围栏的旧 MD 任务仍可 apply  
- [ ] vitest `pro2-production-script*.test.ts` 全绿  

---

## 8. 遗留（后续迭代）

- Story-Pro 1.0 / sbv1 结构化  
- 电商 / 拆图拆视频 adapter  
- 删除 MD 回退与 `parse-md-tables` 主路径  
- 存量 graph 批量迁移 `productionScript`

## 9. 已实现增强（2026-08-19 续）

| 能力 | 说明 |
|------|------|
| Hub 结构化编辑 | 全屏编辑器 **「结构化」** Tab · `Pro2ProductionScriptEditor` · 自动同步 `*Md` / rows |
| 色块 UI | `Pro2ColorBlockPicker` · 场景/分镜 `colorBlock` · 日/夜景板 |
| Gateway JSON | Pro2 hub 段 LLM 自动 `response_format: json_object` |
| 自动重试 | 服务端 Zod 失败 → 追加纠错 user 消息 **重试 1 次** · `resultPayload.pro2ScriptValidation` |
