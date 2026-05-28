# 影视专业版 · 角色一致性与生产闭环实施计划

> **状态**：P0–P4 已完成 · 2026-05-27  
> **关联**：[story-pro-workflow-canonical.md](../../../canvas-web/docs/story-pro-workflow-canonical.md)

---

## 进度总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| **P0** 体验修复 | ✅ 完成 | 配色 + 删列后重定稿 |
| **P1** 静帧先行 | ✅ 完成 | UI + runner `FRAME_IMAGE_REQUIRED` |
| **P3** 静帧验收 | ✅ 完成 | 通过/驳回 + `FRAME_NOT_APPROVED` |
| **P2** 角色资产库 | ✅ 完成 | 四槽 UI + @ 多 ref + 工具栏侧栏 + runner `imageInputs` |
| **P4** 模型路由 | ✅ 完成 | capabilities 元数据 + EnginePicker 黄条 + 服务端校验 |

---

## P0 · 体验修复 ✅

- [x] `NodeShell` 使用传入 `accent`（cyan）
- [x] `reconcileStoryProStyleFinalized` + `onNodesChange` / `removeNode`
- [x] 列节点 `story-edition-chrome`

---

## P1 · 静帧先行 ✅

- [x] `book-mall/lib/canvas/story-frame-gate.ts` · `canvas-web/lib/canvas/story-frame-gate.ts`
- [x] `runStoryProVideoRow` / `runStoryVideoColumnVideoRow` 强制首帧
- [x] `commitStoryVideoRowRun` 支持 `story-pro-video` + 客户端拦截
- [x] 无分镜图时不显示视频生成按钮（视频列显示锁定提示）

---

## P3 · 静帧验收闭环 ✅

- [x] `StoryFrameRow.frameApprovedAt` / `frameRejectedReason`
- [x] 分镜图「通过 / 驳回」；重跑静帧清除过审
- [x] Runner `FRAME_NOT_APPROVED`
- [x] `buildVideoRowsFromFrames` 同步 `frameApprovedAt` 到视频行

---

## P2 · 角色资产库 ✅

- [x] Prisma `StoryProCharacterAsset` / `StoryProCharacterAssetRef`
- [x] `story-pro-character-asset-service.ts`（含锁定 / 删 ref）
- [x] `GET/POST /api/canvas/story-pro/character-assets`
- [x] `PATCH .../character-assets/[id]` · `DELETE .../refs/[refId]`
- [x] 人物设计列四槽 UI（脸/全身/服装/三视图 · 上传/生成/锁定）
- [x] 分镜列加载 project 资产 → `assetRefsByKey` → `@` 多 ref
- [x] 工具栏「项目角色资产」侧栏
- [x] `runStoryProFrameRow` / `runStoryProVideoRow` 组装 `imageInputs[]`

---

## P4 · Gateway 能力路由 ✅

- [x] `story-model-capabilities.ts`（canvas-web + book-mall）
- [x] `model-router.ts` re-export 能力查询
- [x] `EnginePicker` · `requiredCapabilities` + 不兼容黄条
- [x] 人物/场景/分镜列 IMAGE · multi_ref；分镜 VIDEO · i2v
- [x] `assertStoryProRunModelCapabilities` 服务端 run 校验

---

## E2E 验收路径

定稿 → 风格定稿 → 人物四槽入库 → 分镜 @ 多角色 ref → 静帧过审 → i2v 生视频

---

## 后续 · 资产工作流增强

见 [2026-story-pro-asset-workflow-rollout.md](./2026-story-pro-asset-workflow-rollout.md)（P-A1–P-B2）

## KIE 静帧模型（P-F1 ✅）

`STORY_PRO_FRAME_IMAGE_MODEL_KEYS`：nano-banana-pro · flux-2-pro · seedream-5-lite · seedream-4.5 · gpt-image-2 · gpt-image-1 · hunyuan-3d-*；无 @ 时可选 qwen-text-to-image
