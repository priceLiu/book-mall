# 专业拉片 · 结构化契约

围栏：**`film-pull`**（禁止用 json / media-decompose 代替）

## analyze_complete

```json
{
  "schemaVersion": 1,
  "action": "analyze_complete",
  "meta": {
    "totalDurationSec": 15,
    "narrativeMainLine": "夏季海滩俱乐部多巴胺带货短片，七镜硬切节奏",
    "editRhythmCurve": "平均镜长约2.1s；稳-稳-_burst-慢-收；全硬切",
    "artStyle": "高饱和多巴胺配色；红蓝奶油白锚点",
    "audioDesignLogic": "电子 BGM 卡点；环境海浪底",
    "shotSequenceLogic": "中景→中近→特写→全景→中景→特写收束",
    "cameraLanguageSummary": "镜1横移；镜3/7推近；其余固定微手持"
  },
  "shootingPrep": {
    "venue": "海滨沙滩俱乐部/海滩咖啡，红白条纹伞+豆袋沙发区",
    "costume": "蓝棒球帽+橙框墨镜+红色美式印花T+蓝波点阔腿裤+黄腰带",
    "props": "可乐罐、黄色网球拍、西瓜切块",
    "equipment": "手机或微单+稳定器"
  },
  "narrativeLogic": "（总结性长文：须与 meta + 各镜 narrativeFunction 一致，可分段写镜1–7功能）",
  "beatPoints": "（总结性长文：须与 meta 节奏字段 + 各镜 cutDetail 一致）",
  "replicableShootingScript": "（总结性长文：须含【准备】= shootingPrep、【拍摄清单】= shots 逐镜流程）",
  "shots": [{
    "shotNo": 1,
    "startTimeSec": 0,
    "endTimeSec": 2,
    "durationSec": 2,
    "cutTransition": "硬切",
    "cutDetail": "镜1→镜2：碰罐动作与喝对口型 match cut",
    "shotScale": "中景",
    "cameraAngle": "侧平视",
    "cameraMovement": "横移跟拍",
    "focalLengthPerspective": "标准50mm",
    "composition": "伞群对角引导线",
    "subjectBlocking": "持可乐罐走向豆袋区",
    "sightDirection": "侧视前方",
    "sceneEnvironment": "海滩咖啡区，红白条纹伞背景",
    "foreMidBackLayer": "前景伞沿；中景人物；后景海平线",
    "dynamicProps": "可乐罐",
    "lightingSetup": "侧顺光，高饱和",
    "toneContrast": "红蓝高对比",
    "narrativeFunction": "入场建场与人物亮相",
    "audioInfo": {
      "scriptSubtitle": "无",
      "vocalEmotion": "无",
      "ambientSound": "海浪、环境人声",
      "fxAndBgm": "电子BGM入场"
    },
    "rhythmWeight": "铺垫",
    "visualMetaphor": "无",
    "aiVisualPrompt": "中景。海滨沙滩俱乐部，高饱和多巴胺配色。画面中一位戴蓝棒球帽的女性手持可乐罐走向豆袋沙发。侧顺光，红蓝奶油白锚点。"
  }]
}
```

## render_script_complete

在 analyze 结构基础上增加 `renderGlobalConfig`；继承 `shootingPrep` 与场景/光影/音频；**只换人物**相关字段。

## 规则

1. 回复**整段**仅为唯一 ` ```film-pull ` 围栏（**禁止** Markdown 分镜表/前言）
2. `shootingPrep` 四字段 + `shots` 每镜 **25 维 + cutDetail + audioInfo** 为结构化真源
3. `narrativeLogic` / `beatPoints` / `replicableShootingScript` 为 JSON **字符串字段**，**必填**总结长文，**不得**包含 JSON 中不存在的信息
4. 无真实内容时少数列可填 `"无"`（见 skill.md）；`shootingPrep.venue`、多数镜 `sceneEnvironment`、非末镜 `cutDetail` **禁止**全片「无」

## 严格校验

| 检查项 | 要求 |
|--------|------|
| 语法 | schemaVersion、时间 number、audioInfo、无尾逗号 |
| shootingPrep.venue | 非「无」 |
| sceneEnvironment | 超过半数镜不得为「无」 |
| cutDetail | 多镜时多数非末镜不得为「无」 |
| meta vs beatPoints | beatPoints 非空时 editRhythmCurve 不得为「无」 |
