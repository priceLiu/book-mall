# Script Studio JSON v1

## 围栏契约

LLM **只输出** 唯一围栏：

```script-studio-batch
{
  "schemaVersion": 1,
  "action": "batch_complete" | "first_round_with_bibles",
  "system": "original" | "adaptation",
  "batch": { "startEpisode", "endEpisode", "totalEpisodes" },
  "frozenBibles": { "worldview", "characters", "scenes", "synopsis" },
  "validationReport": "可选 · 10 集校验报告",
  "episodes": [ /* 见下 */ ]
}
```

- 禁止 Markdown 章节、GFM 表、围栏外说明。
- 校验失败 → 任务失败并重试（至多 5 次，同 `pro2-production-script-llm`）。

## 单集 episodes[] 模块（与 MD parse 1:1）

| 模块 | JSON 字段 | 说明 |
|------|-----------|------|
| 1 基础 | `module1_base` | 集标题、梗概等 |
| 2 角色 | `module2_characters[]` | 人设表 |
| 3 场景 | `module3_scenes[]` | 场景档案 |
| 4 道具 | `module4_props[]` | 道具表 |
| 5 大纲 | `module5_outline` | 本集大纲 |
| 6 剧本 | `module6_script` | 正文 |
| 7 分镜 | `module7_storyboard[]` | 导演表行 |
| 8 生图 | `module8_imagePrompts[]` | `{ frameIndex, zh, en }` |
| 9 视频 | `module9_videoParams[]` | 视频参数 |
| 10 剪辑 | `module10_editNotes` | 剪辑备注 |

## 存库与展示

| 字段 | 用途 |
|------|------|
| `scriptStudioCanonicalJson` | 机器真源（批次 JSON 合并） |
| `scriptStudioCompletedBatchesMd` / `outlineMd` | **渲染**展示，非 LLM 输出 |
| `meta.scriptStudioFormat=json-v1` | 新项目标记；无标记 → MD 只读 legacy |

## 批次接续

第 2 批及以后 user prompt 注入 **compact JSON 摘要**（frozen + 已完成集 module 摘要），非整段 MD 粘贴。

## 发布

`exportScriptPackageDraft` payload 含 `canonicalJson` + 渲染 `markdown`；下游 `scriptStudio*Rows` 结构不变。

## 相关文件

- Schema：`canvas-web/lib/canvas/data/script-studio-batch-schema.ts`（book-mall 镜像）
- LLM：`book-mall/lib/canvas/script-studio-llm.ts`
- Apply：`canvas-web/lib/canvas/script-studio-json-apply.ts`
- Runner：`book-mall/lib/canvas/story-pro-workspace-runner.ts` · `canvas-engine-runner.ts`
