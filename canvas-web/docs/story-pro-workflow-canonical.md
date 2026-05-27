# 影视专业版 · 故事创作工作流（标准 · 唯一真源）

> **强制**：凡改动 **story-pro** 节点、定稿、spawn、run、布局，**必须先读本文**。  
> **禁止**修改快手版 [`story-workflow-canonical.md`](./story-workflow-canonical.md) 语义。

关联：[story-pro-edition-requirements.md](./story-pro-edition-requirements.md) · [story-editions-overview.md](./story-editions-overview.md) · [design.md](./design.md)

---

## 1. 一句话

**主题 → 故事定稿（含可行性确认）→ 风格定稿 → 拆分设计/分镜/视频列 → 用户手动生成媒体。**

---

## 2. 五阶段

```text
阶段 A · 故事层（story-pro-script-hub）
  大纲 / 角色 / 分镜 / 对白 + AI 可行性（软门禁）
  → 故事定稿 scriptFinalized

阶段 B · 风格层（story-pro-style）
  风格定义 + 锚定词 + 参考图（≥3）
  → 风格定稿 styleFinalized

阶段 C · 设计层
  story-pro-character · story-pro-scene（仅拆分 rows，不自动生图）

阶段 D · 分镜层
  story-pro-frame（镜号/景别/运镜/时长/难度）

阶段 E · 视频层
  story-pro-video + jianying-export-pro
```

定稿后 **仅拆分**，**禁止**自动 enqueue 媒体（与快手版阶段 B 一致）。

---

## 3. 固定节点链

| 顺序 | type | 名称 |
|------|------|------|
| 1 | `story-pro-starter` | 影视专业 · 启动 |
| 2 | `story-pro-script-hub` | 故事剧本 |
| 3 | `story-pro-style` | 风格定义 |
| 4 | `story-pro-character` | 人物设计 |
| 5 | `story-pro-scene` | 场景设计 |
| 6 | `story-pro-frame` | 分镜脚本 |
| 7 | `story-pro-video` | 分镜视频 |
| 8 | `jianying-export-pro` | 剪映导出 |

连线：`starter → script → style → character → scene → frame → video → export-pro`

---

## 4. 门禁

| 门禁 | 条件 |
|------|------|
| 故事定稿 | 大纲非空 + 可行性软确认（高风险二次 confirm） |
| 风格定稿 | 锚定词中英非空 + refImages ≥ 3 |
| 下游 run | `styleFinalized === true`，否则 403 |

---

## 5. 隔离

- `StoryProWorkspaceIds.scriptHubId` + 列节点 `hubNodeId`
- 禁止 `find(第一个 story-comic-starter)`；用 `resolveStarterForHub(hubNodeId)`
- type 前缀 `story-pro-*`，与快手版零共用

---

## 6. Gateway

- 全部经 Gateway；见 `.cursor/rules/canvas-gateway-no-direct-connect.mdc`
- `clientPage`: `canvas/{projectId}/story-pro`
- 风格锚定：`prependStoryProStyleAnchor`（book-mall）

---

## 7. 代码锚点

| Concern | 模块 |
|---------|------|
| 类型 | `story-pro-workspace-types.ts` · `types.ts` |
| Spawn | `spawn-story-pro-workspace.ts` |
| Layout | `story-pro-workspace-layout.ts` |
| Resolver | `story-workspace-resolver.ts` |
| Runner | `book-mall/lib/canvas/story-pro-workspace-runner.ts` |
| Run API | `run/route.ts` story-pro 分支 |
| 节点 UI | `components/canvas/nodes/story-pro-*` |
| Palette | `node-palette.tsx` · `STORY_PRO_PALETTE` |
| 模板 | `templates.ts` · `builtin/story-pro-pipeline` |

---

## 8. 进度

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 文档 + Gateway 规则 | done |
| 1 | 类型 / spawn / layout / resolver | done |
| 2 | script + style + runner | done |
| 3 | character + scene | done |
| 4 | frame + video | done |
| 5 | export + template | done |
| 6 | QA | done |

---

## 9. 变更本规范

须同步更新本文、`story-pro-edition-requirements.md`、`.cursor/rules/story-pro-workflow-canonical.mdc`。
