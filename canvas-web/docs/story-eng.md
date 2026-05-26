# 漫剧向导式 Canvas 工作流（四节点）

在 **canvas-web** 画布内分步完成漫剧生产；与 story-web **数据不互通**。

> **操作手册**：[story-ops.md](./story-ops.md)  
> **设计规范（尺寸 / 按钮 / 弹层 / 文案 / 对比）**：[design.md](./design.md)

## 四节点架构

| 节点 | 职责 |
|------|------|
| **漫剧启动** | 主题 + LLM 模型；**创建工作区**（不自动跑文案） |
| **漫剧文案** `story-script-hub` | 同屏四段：大纲 / 角色表 / 分镜表 / 对白；每段独立 **生成** |
| **角色列** | 行级三视图预览 + 批量生图 |
| **分镜列** | 左文案右分镜图（FrameCard 风格）+ 对比 |
| **视频列** | 分镜视频 + 配音 |
| **剪映导出** | 从视频列/分镜列组装 ZIP |

不再使用 `sc-group-*` 分组框与散落的 `three-view-engine` / 分镜 `image-engine` 子节点；媒体结果存在列节点 `rows[]` 内，book-mall run 通过 `rowKey` + `mediaKind` 区分任务。

## 数据流

```text
漫剧启动 → 创建工作区
  └─► 漫剧文案（按需生成各段 LLM）
  └─► 角色列 · 三视图（rowKey + threeView）
  └─► 分镜列 · 静帧（frameImage）
  └─► 视频列 · 视频 + TTS
  └─► 剪映导出
```

## 实现索引

| 模块 | 路径 |
|------|------|
| 类型与默认 data | `lib/canvas/story-workspace-types.ts`、`types.ts` |
| 创建工作区 | `lib/canvas/spawn-story-workspace.ts` |
| 列同步 | `lib/canvas/story-column-sync.ts` |
| 任务落库到行 | `lib/canvas/story-run-apply.ts` |
| 运行队列 | `lib/canvas/run-queue.ts`、`lib/canvas/canvas-run-bus.ts` |
| book-mall run | `book-mall/lib/canvas/story-workspace-runner.ts` |
| 节点 UI | `components/canvas/nodes/story-*-*.tsx` |
| 布局 | `lib/canvas/story-comic-workspace-layout.ts` |
