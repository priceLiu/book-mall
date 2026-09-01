# 专业拉片 · 结构化契约

围栏：**`film-pull`**（禁止用 json / media-decompose 代替）

## analyze_complete

```json
{
  "schemaVersion": 1,
  "action": "analyze_complete",
  "meta": {
    "totalDurationSec": 32.47,
    "narrativeMainLine": "…",
    "editRhythmCurve": "…",
    "artStyle": "…",
    "audioDesignLogic": "…",
    "shotSequenceLogic": "…",
    "cameraLanguageSummary": "…"
  },
  "narrativeLogic": "整体叙事逻辑拆解（全片结构、各段功能与时长）",
  "beatPoints": "镜头卡点要点（关键秒点、切点、音效/BGM、剪辑节奏）",
  "replicableShootingScript": "可直接落地复刻的同款拍摄脚本（准备/场景/流程/文案/姿态运镜）",
  "shots": [{
    "shotNo": 1,
    "startTimeSec": 0,
    "endTimeSec": 2.13,
    "durationSec": 2.13,
    "cutTransition": "硬切",
    "shotScale": "中景",
    "cameraAngle": "平视",
    "cameraMovement": "固定机位",
    "focalLengthPerspective": "标准50mm",
    "composition": "三分线构图",
    "subjectBlocking": "…",
    "sightDirection": "…",
    "sceneEnvironment": "…",
    "foreMidBackLayer": "…",
    "dynamicProps": "无",
    "lightingSetup": "…",
    "toneContrast": "…",
    "narrativeFunction": "…",
    "audioInfo": {
      "scriptSubtitle": "无",
      "vocalEmotion": "无",
      "ambientSound": "无",
      "fxAndBgm": "无"
    },
    "rhythmWeight": "铺垫",
    "visualMetaphor": "无",
    "aiVisualPrompt": "…"
  }]
}
```

## render_script_complete

在 analyze 结构基础上增加 `renderGlobalConfig`，shots 内 `aiVisualPrompt` / `subjectBlocking` / `sightDirection` 已换角；**镜数、durationSec、start/end 不变**。

```json
{
  "schemaVersion": 1,
  "action": "render_script_complete",
  "renderGlobalConfig": {
    "characterUnifiedStyle": "…",
    "globalLighting": "…",
    "resolution": "1920×1080",
    "fps": "24fps",
    "globalVisualTone": "…"
  },
  "meta": { "…": "同 analyze" },
  "shots": [{ "…": "同 analyze，人物相关字段已换角" }]
}
```

## 规则

1. 回复末尾唯一 ` ```film-pull ` 围栏
2. 无对应内容填 `"无"`
3. `shots` 至少 1 镜
4. `narrativeLogic` / `beatPoints` / `replicableShootingScript` **必填** string（可与 Markdown 三块段落一致，长文用 `\n` 换行）
