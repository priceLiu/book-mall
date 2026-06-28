# 影视专业版 2.0（story-pro2）· 标准工作流

> **状态**：需求真源 · 2026-06  
> **关联**：[story-editions-overview.md](./story-editions-overview.md) · [plan-2.0.md](./plan-2.0.md)  
> **1.0 对照**：[story-pro-workflow-canonical.md](./story-pro-workflow-canonical.md)（冻结，不改）

---

## 1. 三轨划分（强制）

| 名称 | 代号 | 定位 |
|------|------|------|
| 基础快手版 | `story-comic` | 冻结 |
| 影视专业版 1.0 | `story-pro` | 冻结维护 |
| **影视专业版 2.0** | `story-pro2` | LibTV 架构；新复杂需求入口 |

**不可共用** type 前缀；同画布仅一种漫剧轨道。隔离真源：`lib/canvas/story-edition-isolation.ts`。

---

## 2. 交互范式（与 1.0 的本质差别）

1. **画布**：节点为 **薄摘要卡**（阶段、状态、计数、封面缩略图）  
2. **编辑**：选中节点 → **右侧检视面板** 展示完整表单/行表/生成控件  
3. **生成**：检视面板底部 Composer；画布卡片仅显示进度徽标  
4. **连线**：保留 RF Handle 语义；spawn 仍由定稿按钮触发  

---

## 3. 五阶段 ↔ 节点

| 阶段 | 节点 type | 薄卡信息 | 检视面板 |
|------|-----------|----------|----------|
| 故事 | `story-pro2-starter` | 上传/解析阶段 | 剧本上传、导演包、引擎 |
| 故事 | `story-pro2-script-hub` | 定稿状态、Tab 摘要 | 大纲/角色/分镜/对白审阅 |
| 风格 | `story-pro2-style` | 锚定词一行、参考图数 | 完整风格定义 + 定稿 |
| 设计 | `story-pro2-character` | 角色行数、生成进度 | 行表、三视图、批量 |
| 设计 | `story-pro2-scene` | 场景行数 | 场景参考、批量 |
| 分镜 | `story-pro2-frame` | 镜号条/缩略图带 | 景别/运镜/静帧生成 |
| 视频 | `story-pro2-video` | 视频条带状态 | 生成/预览/TTS |
| 导出 | `jianying-export-pro2` | ZIP/剪辑状态 | 剪映包、自动剪辑 MP4 |

---

## 4. 定稿与门禁（与 1.0 相同）

1. **故事**：用户在 `story-pro2-script-hub` 检视面板编辑并 **定稿生成工作流** → `scriptFinalized`  
2. **风格**：`styleFinalized` 前禁止下游媒体 run  
3. **媒体**：定稿 **不自动** 跑生成；用户在各列单镜或批量触发  
4. **解除定稿**：删除本套媒体列 → reconcile 解除（复用 pro 逻辑）  

软可行性门禁、剧本制作包结构：沿用 `story-pro-script-pack.ts`。

---

## 5. Gateway

- 禁止直连厂商  
- `clientPage`: `canvas/{projectId}/story-pro2`  
- 风格锚定：`prependStoryProStyleAnchor`（row 不可关闭）  

---

## 6. 数据

- Row 字段与 `StoryPro*Row` **1:1**（`story-pro2-workspace-types.ts`）  
- 任务表：`CanvasGenerationTask`（不新增表）  
- Graph：`schemaVersion: 3`，`meta.edition: "pro2"`  

---

## 7. 非目标

- 不改造 `story-pro-*` 节点 UI  
- 不做 pro → pro2 自动迁移  
- 首期不引入 Pixi 全画布  

---

## 8. 工业化剧本创作（script-studio · 2026-06）

与标准 2.0 **同 edition（pro2）**，入口模板 `builtin/story-pro2-script-studio`。

| 能力 | 实现 |
|------|------|
| 分批生成 | starter `scriptStudio*` · 10 集/批 · `ScriptStudioBatchPanel` |
| 冻结档案 | 首轮 4 份 bible → starter/hub + OSS |
| 解析落列 | `script-studio-run-apply` → hub + character/scene/frame/prop/mood/audio 列 rows |
| 定稿导出 | hub 工具条「导出剧本包」→ `SCRIPT_PACKAGE` ProjectAsset |
| 生产关联 | 模板 `builtin/story-pro2-production` · `graphMeta.requireScriptLink` · 关联条 + 软门禁 |
| 看板 | frame row `episodeNo` / `stageStatus` · `Pro2DirectorOverview` |
| 协同 | 导出时可设团队可见；关联时 `acquireProjectAssetLease` 认领 |

真源：`docs/2.0 工业标准化脚本生产.md` · 进度 `docs/影视标准化工作流改造.md`。
