# 画布生图 · 交通控流与宫格高清队列

## 背景

宫格高清批量生成（100+ 节点）曾依赖 **canvas-web 前端 sequential 队列**，存在：

- 单节点裁切/校验失败 → `abortSequential` 清空整批
- 生图 **同步直提 Gateway**，无 QUEUED pending 日志
- 看门狗仅覆盖 video-engine，IMAGE 不入队

## 目标态

| 需求 | 实现 |
|------|------|
| 100 个任务互不阻塞 | 独立节点失败仅标记当前 node，继续推进 cursor；宫格 HD 改 **并行 enqueue** |
| 闲时高并发 / 忙时限流 | **book-mall traffic-control** 统一 QUEUED → DISPATCHING → Gateway |
| 6 次重试后失败 | 复用 `DISPATCH_STALE_RETRY_MAX`（默认 6）· `dispatchStaleRetryCount` |
| Gateway 全程可见 | pending 行扩展 **IMAGE** + **PREPARING**（宫格裁切） |

## 架构

```
用户点击 → run API → CanvasGenerationTask(QUEUED)
         → fireCanvasDispatchForProject
         → dispatchQueuedCanvasTasks（poll worker / 热路径）
              → 占槽 DISPATCHING
              → [PREPARING] gridSplitPrepare → crop OSS
              → createTask → GatewayRequestLog
              → SUBMITTED → poll → SUCCEEDED/FAILED
```

前端：**batchRunNodes** 并行入队；状态以 task 轮询为准。

## 关键模块

| 文件 | 职责 |
|------|------|
| `lib/canvas/canvas-traffic-kind.ts` | video/image traffic kind 判定 |
| `lib/generation/traffic-control/dispatch-canvas-image.ts` | 生图派发 + 宫格 PREPARING |
| `lib/generation/traffic-control/dispatch-canvas.ts` | 统一出队（video + image） |
| `lib/canvas/canvas-engine-runner.ts` · `runImageEngineNode` | traffic 开启时 QUEUED 早退 |
| `lib/canvas/canvas-pending-log-row.ts` | pending IMAGE / PREPARING |
| `canvas-web/lib/canvas/run-queue.ts` | 独立 job 失败不清 sequential |
| `canvas-web/components/canvas/libtv-image-node.tsx` | 宫格 HD → `batchRunNodes` |

## inputPayload 扩展

```json
{
  "kind": "image-engine",
  "gridSplitPrepare": {
    "sourceUrl": "https://…/grid.jpg",
    "col": 0, "row": 1, "cols": 3, "rows": 3
  },
  "pipelineStage": "PREPARING",
  "dispatchStaleRetryCount": 1
}
```

裁切完成后清除 `gridSplitPrepare` / `pipelineStage`，写入 `imageUrls`。

## 回退

`TRAFFIC_CONTROL_OFF=1` → 生图恢复 run API **同步 submit**（与改前一致）。

## 实施阶段（已完成）

### P0
- [x] IMAGE 入 QUEUED + dispatch
- [x] 宫格裁切迁入 dispatch PREPARING
- [x] 前端 independent job 失败不 abort 整批
- [x] 宫格 HD 并行 enqueue

### P1
- [x] pending log IMAGE + PREPARING
- [x] recover-stale-dispatching 覆盖 image
- [x] Gateway UI PREPARING 状态展示

### P2（可选后续）
- [ ] 前端完全去掉 sequential 作为 HD 入队方式（已并行，保留 sequential 仅 story 链）
- [ ] inputHash 纳入 gridSplitPrepare 坐标

## 测试

```bash
cd book-mall && pnpm exec vitest run test/unit/canvas-traffic-kind.test.ts test/unit/canvas-queue-blocking-stress.test.ts
```

`canvas-queue-blocking-stress.test.ts`：100 独立任务在第 12 个失败时仍处理完全部，验证不阻塞。

## 验证清单（手工）

1. 重启 book-mall + 硬刷新 canvas-web
2. 宫格多选 → HD 2×：节点即时出现，全部 queued
3. Gateway Logs：每条 pending QUEUED → PREPARING（如有裁切）→ 真实 log
4. 故意让单格裁切失败：其余格仍继续
5. 6 次 dispatch 超时后 task FAILED，`failCode=SUBMIT_DISPATCH_TIMEOUT`
6. Gateway 已成功时，节点应在下一次 `/tasks` 轮询内退出「生成中」（读路径批量 recover + 前端 taskId 对齐）

## 节点类型 · Gateway 与排队机制

| 节点 / payload.kind | Gateway | 交通控流 QUEUED | 说明 |
|---------------------|---------|-----------------|------|
| `image-engine` / `three-view-engine` | ✅ KIE/混元/可灵 | ✅（`TRAFFIC_CONTROL_OFF≠1`） | 异步出图，dispatch + poll |
| `video-engine` / `ai-video-engine` | ✅ | ✅ | 异步视频 |
| `ai-engine`（TEXT） | ✅ chat/completions | ❌ 同步 | run API 内同步 LLM，`SUBMITTED`；读路径 `recoverProjectInflightTextTasksForRead` |
| `tts-engine`（音频） | ✅ TTS | ❌ 同步 | run API 内同步落 OSS，任务直接 `SUCCEEDED`/`FAILED` |
| Story 列行（三视图/分镜/视频/TTS） | ✅ | 视频 ✅ / 其余 mostly 同步或行级 | 见 `story-workspace-runner` |

**结论：** 异步 **IMAGE/VIDEO** 走 QUEUED 排队 + 看门狗；**文本/音频** 仍走 Gateway，但在 run API **同步完成**（不占 DISPATCHING 槽等待厂商 callback）。若需文本也入队，需单独立项扩展 `dispatch-canvas-text.ts`。

## 前端终态同步（Gateway 已完成仍「生成中」）

根因通常有两类：

1. **Canvas 任务仍 SUBMITTED**：Gateway log 已成功但 DB 未写回 → `/tasks` 读路径 `recoverProjectInflightKieImageTasksForRead`（现已批量最多 50 条/次）
2. **前端 patch 缺口**：`sbv1ImagePatchFromTask` 未处理 QUEUED/DISPATCHING；`pickPreferredCanvasTask` 未优先本地绑定的 SUCCEEDED 任务

修复见：`sbv1-image-task-apply.ts`、`task-pick.ts`、`run-queue.ts`、`story-inflight-reconcile.ts`。
