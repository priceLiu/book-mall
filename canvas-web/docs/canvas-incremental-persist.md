# Canvas 增量保存 · 实施文档

## 背景

画布 autosave 原先每次 PATCH 携带 **完整 `canvas` JSON**。大项目 payload 大、与粘贴 OSS 上传争抢，且 autosave 可能在 `ossUrl` 写入前落盘导致 **重开项目图片丢失**。

前置修复（仍保留）：

- **上传链路**：blob 预览 → OSS 队列 → drain 落盘（不经 autosave debounce）
- **内容判脏**：`canvas-persist-snapshot` strip 后 JSON 相同则 **零 PATCH**

本实施在判脏之上增加 **`canvasDelta` 增量 PATCH**。

## 双链路架构

```
┌─────────────────────────────────────────────────────────────┐
│ 粘贴 / 选图上传                                              │
│   blobUrl 预览 → scheduleCanvasImageUpload → OSS            │
│   drain → canvasDelta.upsertNodes（整 strip 节点）           │
│   失败 → fallback 整图 flushCanvasGraphPersist              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 编辑 autosave（debounce）                                    │
│   isCanvasPersistContentDirty? → buildCanvasPersistDelta     │
│   PATCH canvasDelta（典型：变更 node + viewport）            │
│   >500 节点 → fallback 整图 canvas                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 手动保存                                                     │
│   仍 PATCH 完整 canvas + historySnapshot source=manual       │
└─────────────────────────────────────────────────────────────┘
```

API 契约详见 [`book-mall/doc/tech/canvas-delta-patch.md`](../../book-mall/doc/tech/canvas-delta-patch.md)。

## 乐观锁（软放行）

- 客户端仍携带 `baseUpdatedAt`（上次 PATCH 的 `project.updatedAt`），便于观测。
- **服务端不再因 mismatch 硬 409**：任务成片 / OSS backfill 也会 bump `updatedAt`，硬锁会导致增量 autosave 失败风暴（「以前整图保存没事、上增量后坏」的根因）。
- mismatch 时在**最新** DB canvas 上 `applyDelta`，再经 `mergePersistedMediaIntoCanvasGraph` 防媒体被抹掉。
- 客户端：autosave **串行**（禁止双 PATCH）；保存中退避 tasks 轮询。

## 实施进度

| Phase | 内容 | 状态 |
|-------|------|------|
| P1 | 服务端 `applyCanvasDelta` + PATCH `canvasDelta` + 409 + 单测 | 已完成 |
| P2 | 客户端 `buildCanvasPersistDelta` + autosave delta + 409 recovery | 已完成 |
| P3 | OSS drain 合并 `upsertNodes` delta + fallback 整图 | 已完成 |
| P4 | 本文档 + API 契约 + 架构 §7 | 已完成 |

### P1 文件

- `book-mall/lib/canvas/canvas-delta-merge.ts`
- `book-mall/lib/canvas/canvas-project-service.ts`
- `book-mall/app/api/canvas/projects/[id]/route.ts`
- `book-mall/test/unit/canvas-delta-merge.test.ts`

### P2 文件

- `canvas-web/lib/canvas/canvas-persist-delta.ts`
- `canvas-web/lib/canvas/canvas-persist-snapshot.ts`（注释更新）
- `canvas-web/lib/canvas-api.ts`
- `canvas-web/app/canvas/[id]/canvas-page-client.tsx`
- `canvas-web/test/unit/canvas-persist-delta.test.ts`

### P3 文件

- `canvas-web/lib/canvas/canvas-pending-image-uploads.ts`
- `canvas-web/lib/canvas/canvas-graph-persist-bridge.ts`
- `canvas-web/lib/canvas/canvas-image-upload-lane.ts`
- `canvas-web/components/canvas/toolbar.tsx`（离开前 flush delta）

## 示例：粘贴一张图

OSS 完成后 drain 发送（示意）：

```json
{
  "canvasDelta": {
    "baseUpdatedAt": "2026-07-31T15:00:00.000Z",
    "upsertNodes": [
      {
        "id": "node-abc",
        "type": "sbv1-image",
        "position": { "x": 120, "y": 80 },
        "width": 512,
        "height": 512,
        "data": {
          "ossUrl": "https://…/paste.png",
          "uploading": false,
          "mediaFitKey": "image|https://…|sbv1-media"
        }
      }
    ]
  }
}
```

新粘贴节点可能尚未整图落库，故 upsert 携带 **strip 后整节点**，而非仅 `data.ossUrl`。

## 测试

```bash
# book-mall
pnpm --dir book-mall exec vitest run test/unit/canvas-delta-merge.test.ts

# canvas-web
pnpm --dir canvas-web exec vitest run test/unit/canvas-persist-delta.test.ts
pnpm --dir canvas-web exec vitest run test/unit/canvas-persist-snapshot.test.ts
```

### 手动验证

1. 粘贴 1 张图 → Network 见 `canvasDelta`（非整图 `canvas`）→ 回项目列表再打开，`ossUrl` 仍在。
2. 拖节点 → autosave body 仅含变更 node / viewport。
3. 无编辑 → 无 PATCH（顶栏不出现「保存中…」）。
4. 手动保存 → 仍整图 `canvas` + 历史条目。

## 已知限制

- **单 tab**：多 tab 同时编辑可能 409；恢复策略为 re-fetch + 重试。
- **大项目**：节点数 > `CANVAS_DELTA_MAX_NODES`（500）时 autosave fallback 整图 PATCH。
- **存储形态**：DB 仍为 monolithic JSON；未做节点表 / CRDT。

## 相关模块

| 职责 | 路径 |
|------|------|
| 上传队列 | `canvas-web/lib/canvas/canvas-pending-image-uploads.ts` |
| Delta 计算 | `canvas-web/lib/canvas/canvas-persist-delta.ts` |
| 判脏快照 | `canvas-web/lib/canvas/canvas-persist-snapshot.ts` |
| 保存桥接 | `canvas-web/lib/canvas/canvas-graph-persist-bridge.ts` |
| 媒体防降级 | `book-mall/lib/canvas/canvas-persist-merge.ts` |
