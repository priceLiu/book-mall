# Canvas · Pro2 制作包映射

`POST .../export/pro2` → `Pro2ProductionScript`（`step=storyboard`）

| FilmPull | Pro2 |
|----------|------|
| `meta.narrativeMainLine` | `meta.synopsis` |
| `meta.artStyle` | `visualStyle.pictureStyle` |
| `shot.shotNo` | `shot.index` |
| `shot.durationSec` | `shot.durationSec` |
| `shot.shotScale` | `shot.shotSize` |
| `shot.cameraMovement` | `shot.cameraMove` |
| `subjectBlocking + sceneEnvironment` | `shot.sceneDescription` |
| `audioInfo.scriptSubtitle` | `shot.dialogue` |
| `aiVisualPrompt` | `shot.videoPrompt` |

Canvas 预设 `video-film-pull`：上传后调用 Platform API，完成后「导入制作包」写入 `story-pro2-script-hub.productionScript`。
