# 影视专业版 · 资产库工作流增强 · 实施计划

> **状态**：已完成 · 2026-05-27  
> **前置**：P0–P4 角色一致性已完成（见 [2026-story-pro-character-consistency.md](./2026-story-pro-character-consistency.md)）  
> **产品说明**：[story-pro-character-asset-workflow.md](../../../canvas-web/docs/story-pro-character-asset-workflow.md)

---

## 1. 背景与目标

**已完成**：四槽角色资产库、分镜 `@` 多 ref、静帧/视频 runner、`EnginePicker` 能力路由、KIE 静帧模型白名单扩展、场景资产库、资产版本快照。

**本计划目标**：在 **不改变五阶段节点链** 的前提下，降低操作成本、提高一致性与可观测性。

---

## 2. KIE 静帧模型接通（P-F1）

| 任务 | 状态 |
|------|------|
| 梳理 `KIE_KNOWN_MODELS` 中带 `imageUrls` 的 IMAGE 模型 | ✅ |
| 新增 `STORY_PRO_FRAME_IMAGE_MODEL_KEYS` | ✅ |
| `story-model-capabilities` 显式标注 flux/seedream/gpt-image | ✅ |
| 分镜列 EnginePicker 改用静帧白名单（非三视图白名单） | ✅ |
| runner 按行校验：有 @ → `image_multi_ref` | ✅ |

---

## 3. 工作流增强分期

### P-A1 · 分镜 @ 辅助

| 任务 | 状态 |
|------|------|
| 从对白/描述匹配角色名 | ✅ |
| 行卡片「建议 @」一键插入 | ✅ |
| `story-pro-frame-ref-suggest.ts` | ✅ |

---

### P-A2 · 风格 ref 可选注入静帧

| 任务 | 状态 |
|------|------|
| 分镜节点开关「注入风格参考图」 | ✅ |
| runner 追加 style ref 到 `imageInputs` | ✅ |
| `story-pro-frame-image-inputs.ts` | ✅ |

---

### P-A3 · 人物三视图 run 带四槽 ref

| 任务 | 状态 |
|------|------|
| `runStoryProCharacterRow` 读取 locked refs | ✅ |
| `story-pro-character-ref-resolve.ts` | ✅ |
| run guards 校验 multi_ref | ✅ |

---

### P-A4 · 资产完备度条

| 任务 | 状态 |
|------|------|
| `story-pro-asset-readiness.ts` | ✅ |
| 分镜行 UI 完备度 + 软 confirm | ✅ |

---

### P-A5 · 分镜批量 @ 与资产同步

| 任务 | 状态 |
|------|------|
| 底栏「为本列补齐 @ 角色」 | ✅ |
| 保存时写入 ref 快照 | ✅ |

---

### P-B1 · 场景资产库

| 任务 | 状态 |
|------|------|
| Prisma `StoryProSceneAsset` / 三槽 ref | ✅ |
| API `/api/canvas/story-pro/scene-assets` | ✅ |
| 场景列三槽 UI | ✅ |
| 分镜 `@` 合并角色+场景目录 | ✅ |
| 工具栏「项目资产」场景 Tab | ✅ |

---

### P-B2 · 资产版本与分镜快照

| 任务 | 状态 |
|------|------|
| `StoryProCharacterAsset.version` bump on ref change | ✅ |
| 分镜行 `characterRefSnapshotAt` / versions | ✅ |
| 行 UI「资产已更新 · 建议重跑静帧」 | ✅ |
| 侧栏显示 version | ✅ |

---

## 4. 实施顺序（已完成）

```text
P-F1 KIE 静帧接通 ✅
  ↓
P-A3 三视图 run 带 ref ✅
  ↓
P-A1 分镜 @ 辅助 ✅
  ↓
P-A4 资产完备度条 ✅
  ↓
P-A2 风格 ref 可选注入 ✅
  ↓
P-A5 批量 @ ✅
  ↓
P-B1 场景资产库 ✅
  ↓
P-B2 资产版本快照 ✅
```

---

## 5. 不需要改动的部分

- 节点 type 与 spawn 链（`story-pro-starter` → … → `jianying-export-pro`）
- 故事/风格定稿门禁
- 静帧过审 → 视频 i2v 门禁
- Gateway 统一出口

---

## 6. 验收标准（整包）

1. 主角四槽入库 → 分镜 `@` → flux/seedream/nano 任一 multi_ref 模型出图 → 过审 → i2v 视频； ✅
2. 无 @ 的纯场景镜可用 qwen 出图； ✅
3. 工具栏「项目资产」与人物/场景列四槽数据一致； ✅
4. 对白含角色名 → 一键补齐 @； ✅
5. 场景三槽入库 → 分镜 `@` 场景 ref 跨镜复用； ✅
6. 换脸/换 ref 后分镜行提示 stale 快照； ✅

---

## 7. 关键文件索引

| 模块 | 路径 |
|------|------|
| 分镜 @ 建议 | `canvas-web/lib/canvas/story-pro-frame-ref-suggest.ts` |
| 完备度 / 快照 | `canvas-web/lib/canvas/story-pro-asset-readiness.ts` |
| 场景资产 catalog | `canvas-web/lib/canvas/story-pro-scene-asset-catalog.ts` |
| 静帧 imageInputs | `book-mall/lib/canvas/story-pro-frame-image-inputs.ts` |
| 角色 ref resolve | `book-mall/lib/canvas/story-pro-character-ref-resolve.ts` |
| 场景 service | `book-mall/lib/canvas/story-pro-scene-asset-service.ts` |
| 迁移 | `book-mall/prisma/migrations/20260527140000_story_pro_asset_workflow/` |

---

## 7. 文档同步

| 文档 | 状态 |
|------|------|
| `canvas-web/docs/story-pro-character-asset-workflow.md` | ✅ 已更新 |
| `canvas-web/docs/story-pro-workflow-canonical.md` | 按需（硬门禁变更时） |
| 本文进度表 | ✅ |
