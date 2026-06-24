# 生成交通式控流 · 实施计划（P0–P3）

> 设计：`2026-06-19-generation-traffic-control.md`  
> **状态**：已实现（2026-06-19）

---

## P0 · 积分不卡死 ✅

| ID | 任务 | 状态 |
|----|------|------|
| P0-1 | `releaseTrafficSlot` 挂接 `finalizeRequestLog` | ✅ |
| P0-2 | `failGatewayLogIfStillRunning` 释放槽位 | ✅ |
| P0-3 | 对账 RUNNING 超时 / 幽灵 RESERVE | ✅ `reconcile.ts` |
| P0-4 | 脚本 `pnpm generation:reconcile-traffic` | ✅ |

---

## P1 · QUEUED + 延迟 RESERVE ✅

| ID | 任务 | 状态 |
|----|------|------|
| P1-1 | Migration + `GenerationTrafficState` | ✅ `20260619230000_generation_traffic_control` |
| P1-2 | 视频 admit → QUEUED | ✅ `canvas-engine-runner` |
| P1-3 | poll dispatch | ✅ `dispatch-canvas.ts` |
| P1-4 | `TRAFFIC_CONTROL_OFF=1` 回退 | ✅ |
| P1-5 | 排队超时 CANCELLED | ✅ |

---

## P2 · 三层交通 ✅

| ID | 任务 | 状态 |
|----|------|------|
| P2-1 | Token bucket | ✅ `token-bucket.ts` + `slot.ts` |
| P2-2 | Actor spacing 2.5s | ✅ |
| P2-3 | 信号灯 + `Tenant.maxConcurrency` | ✅ |
| P2-4 | 对账校正 `runningVideoCount` | ✅ |

---

## P3 · Story + 前端 ✅

| ID | 任务 | 状态 |
|----|------|------|
| P3-1 | Story `FRAME_VIDEO` QUEUED | ✅ `story-task-service` + `dispatch-story.ts` |
| P3-2 | canvas-web QUEUED/DISPATCHING | ✅ `task-pick.ts` 等 |
| P3-3 | 图像不走 QUEUED | ✅ 未改图像路径 |

---

## 部署注意

1. **迁移**：`pnpm --dir book-mall db:deploy`（或 Docker build 内 migrate）
2. **对账 cron**：每 5～10min 调 `pnpm generation:reconcile-traffic`（可与 poll SCF 同机）
3. **回退**：生产 env 设 `TRAFFIC_CONTROL_OFF=1` 恢复同步 submit
4. **dispatch 不变量**（防生产线卡死）：[`../tech/generation-traffic-dispatch-invariants.md`](../tech/generation-traffic-dispatch-invariants.md)

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-06-19 | P0–P3 全量实现 |
| 2026-06-24 | dispatch 占槽 tx 规范固化（R1.1）；见 invariants 文档 |
