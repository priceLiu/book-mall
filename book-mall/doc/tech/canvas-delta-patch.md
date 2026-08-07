# Canvas PATCH · canvasDelta 增量契约

## 端点

`PATCH /api/canvas/projects/:id`（book-mall，canvas-web 经 BFF 同域或直连 Book）

## Body 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 可选，重命名 |
| `description` | string | 可选 |
| `thumbnailUrl` | string | 可选，项目封面 |
| `canvas` | object | **整图替换**（手动保存、历史恢复、旧客户端） |
| `canvasDelta` | object | **增量变更**（autosave、OSS 上传落盘） |
| `historySnapshot` | object | 可选；与 `canvas` 或 `canvasDelta` 同请求时写入历史 |

**互斥**：同一请求 **不可** 同时携带 `canvas` 与 `canvasDelta` → `400 INVALID_INPUT`。

## canvasDelta 结构

```typescript
type CanvasDeltaPatch = {
  /** 乐观锁：上次成功 PATCH 响应中的 project.updatedAt（ISO 8601） */
  baseUpdatedAt?: string;
  upsertNodes?: Array<{
    id: string;
    type?: string;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    data?: Record<string, unknown>;
    // 其它 React Flow node 字段按需携带
  }>;
  removeNodeIds?: string[];
  upsertEdges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string;
    data?: Record<string, unknown>;
  }>;
  removeEdgeIds?: string[];
  viewport?: { x: number; y: number; zoom: number };
  meta?: Record<string, unknown>; // 浅合并进 canvas.meta
};
```

## 服务端行为

1. 读取 DB 现有 `CanvasProject.canvas` JSON。
2. 若提供 `baseUpdatedAt` 且与行 `updatedAt` 不一致 → **软放行**（打 warn，仍在最新 canvas 上合并）。  
   不再硬 409：任务成片 / OSS backfill 也会 bump `updatedAt`，硬锁会导致增量 autosave 失败风暴。  
   媒体防降级依赖步骤 4；多标签页与整图 PATCH 同为 last-write-wins。
3. `applyCanvasDelta(existing, delta)` 合并：
   - 节点/边按 `id` upsert；`data` **深合并**（partial delta 不抹掉其它字段）。
   - `removeNodeIds` 同时移除关联边。
4. `mergePersistedMediaIntoCanvasGraph(merged, existing)` 防止 autosave 覆盖任务成片。
5. 写回整坨 JSON（存储形态不变，仍为 Prisma `Json`）。

## historySnapshot

与整图 PATCH 相同：`source: "autosave" | "manual"`、`label`、`thumbnailUrl`（视口截图优先）。  
历史条目保存的是 **merge 后的完整 canvas**。

## 错误码

| HTTP | code | 场景 |
|------|------|------|
| 400 | `INVALID_INPUT` | 空 delta、新节点缺 `type`、canvas+delta 同传 |
| 404 | `NOT_FOUND` | 项目不存在或无权限 |

（`baseUpdatedAt` 不匹配不再返回 409；见上文「软放行」。）

## 实现位置

| 模块 | 路径 |
|------|------|
| Delta merge | `book-mall/lib/canvas/canvas-delta-merge.ts` |
| 媒体防降级 | `book-mall/lib/canvas/canvas-persist-merge.ts` |
| 服务层 | `book-mall/lib/canvas/canvas-project-service.ts` |
| 路由 | `book-mall/app/api/canvas/projects/[id]/route.ts` |

## 客户端

- 类型：`canvas-web/lib/canvas/canvas-persist-delta.ts`
- API：`canvas-web/lib/canvas-api.ts` · `patchCanvasProject`
- 实施说明：`canvas-web/docs/canvas-incremental-persist.md`
