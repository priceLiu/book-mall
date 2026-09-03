# Canvas · Pro2 制作包映射（schema v3）

权威规格：[docs/Pro2拉片整合-schema-v3.md](../../../docs/Pro2拉片整合-schema-v3.md)

`POST .../export/pro2` → `Pro2ProductionScript`（`schemaVersion=3` · `packProfile=industrial` · `source=film_pull`）

## 顶层

| FilmPull | Pro2 v3 |
|----------|---------|
| — | `meta.packProfile=industrial` · `meta.source=film_pull` |
| `meta.narrativeMainLine` | `meta.synopsis` |
| `meta.totalDurationSec` | `meta.totalDurationSec` |
| `meta.artStyle` | `visualStyle.pictureStyle` + `styleAnchor` |
| `meta.cameraLanguageSummary` | `meta.cameraLanguageSummary` + `visualStyle.cinematography` |
| `shootingPrep` | `meta.shootingPrep` |
| 三块长文 | `meta.narrativeLogic` / `beatPoints` / `replicableShootingScript` |

## 导演表

| FilmPull | Pro2 |
|----------|------|
| `shotNo` | `shot.index` |
| `durationSec` | `shot.durationSec` |
| `shotScale` | `shot.shotSize` |
| `cameraMovement` | `shot.cameraMove`（不足 12 字则补全） |
| `lightingSetup` + `toneContrast` + `sceneEnvironment` | `shot.lighting` |
| `subjectBlocking` + `sightDirection` | `shot.sceneDescription`（【起始】…【结束】） |
| `audioInfo.scriptSubtitle` | `shot.dialogue`（无说话人则「—」，原文留 analysis） |
| `audioInfo.ambientSound` | `shot.sfxNote` |
| `audioInfo.fxAndBgm` | `shot.audioNote` |

## analysis（完整保留，禁止丢弃）

时间码、切点、机位、焦段、构图、调度、层次、影调、叙事、`audioInfo`、`aiVisualPrompt`→**仅** `analysis.analysisDraftPrompt`。

**禁止**把 `aiVisualPrompt` 写入 `videoPrompt` / `frameImagePrompt`。

## 画布主路径

剧本 Hub：制作档 **专业版** + 上游视频节点（上传 / 粘贴 / 拖入）+ Dock 输入「拉片」→ Hub LLM（`video_url`）直接写 `productionScript`。视频节点 Dock 不再作为拉片控制台。
