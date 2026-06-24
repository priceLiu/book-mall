# 生成交通控流 · dispatch 不变量（防生产线卡死）

> **状态**：强制规范（2026-06-24 起）  
> **关联**：[`2026-06-19-generation-traffic-control.md`](../plans/2026-06-19-generation-traffic-control.md) · [`docs/releases/2026-06-db-resilience-r1.md`](../../../docs/releases/2026-06-db-resilience-r1.md) · Cursor 规则 `.cursor/rules/generation-traffic-dispatch.mdc`

---

## 1. 事故现象（曾两次出现）

| 用户侧 | 系统侧 |
|--------|--------|
| 画布/分镜长时间「排队中 / 生成中」 | 任务停在 `QUEUED` 或 `DISPATCHING` |
| Gateway Logs **无新记录** | `createTask` 尚未成功，尚无 `GatewayRequestLog` |
| 点击多次仍不动 | poll worker 日志 `[canvas-dispatch] skipped (db unavailable?)` |
| 状态页任务 >10min | 部分 `DISPATCHING` + `gatewayKieSubmitClaimed=true` 但无 `gatewayLogId` |

**本质**：出队占槽事务在 DB 繁忙时 **5s 超时**，槽位与任务状态不一致，整批 dispatch 被一次失败打断，生产线 **假死**。

---

## 2. 根因链（必须理解）

```
dev:all / 多 poll 进程 → 连接池 P1017
  → prisma.$transaction 默认 timeout 5000ms
  → acquireTrafficSlotInTx 内又 resolveMaxConcurrencyForScope（额外 prisma 查询）
  → Transaction already closed
  → 外层 catch 跳过本批剩余 QUEUED
  → 个别任务卡在 DISPATCHING（占槽未 submit）
  → UI 显示生成中，Gateway 无 log
```

---

## 3. 代码不变量（新增/修改 dispatch 必遵守）

### 3.1 事务选项

所有 **占槽、claim、短状态迁移** 的 `$transaction`：

```typescript
import { CANVAS_DB_TX_OPTIONS, runTxWithRetry } from "@/lib/db-tx-retry";

await runTxWithRetry(
  () => prisma.$transaction(async (tx) => { /* ... */ }, CANVAS_DB_TX_OPTIONS),
  { label: "canvas-dispatch-slot", maxRetries: 3 },
);
```

**禁止**裸 `prisma.$transaction(fn)`（Prisma 默认 **5s**）。

常量定义：`book-mall/lib/db-tx-retry.ts` → `CANVAS_DB_TX_OPTIONS`（`maxWait: 10s`, `timeout: 30s`）。

### 3.2 事务内禁止外部查询

`resolveMaxConcurrencyForScope(scope)` 会 `tenant.findUnique`，**必须在 tx 外**完成：

```typescript
const maxConcurrency = await resolveMaxConcurrencyForScope(scope);
// tx 内：
await acquireTrafficSlotInTx(tx, scope, maxConcurrency);
```

### 3.3 DISPATCHING 失败必须可恢复

| 条件 | 动作 |
|------|------|
| 无 `gatewayLogId`、无 vendor `taskId` | `releaseTrafficSlot` + 状态 → `QUEUED` + `dispatchAfter` |
| `gatewayKieSubmitClaimed` 卡住 | 重置 claim 标记 + 退回 `QUEUED` |
| 厂商已 createTask（有 logId） | **禁止**退回 QUEUED；用 `runTxWithRetry` 写 `SUBMITTED` |

参考实现：`revertStuckDispatchingTask` in `dispatch-canvas.ts`。

### 3.4 批次 dispatch 错误隔离

`dispatchQueuedCanvasTasks` / `dispatchQueuedStoryTasks`：

1. `cancelQueueTimeouts` / `recoverStaleDispatching` — **各自** try/catch  
2. `findMany` QUEUED — 失败则 return，不 dispatch  
3. **for 循环内**每任务 try/catch — 一单失败不阻断后续  

### 3.5 瞬时繁忙 ≠ 业务失败

`isTransientSystemBusyError`（503、连接池、tx timeout、P2034）→ 退回 **QUEUED**，**不得** `FAILED` + 误导 failCode。

### 3.6 canvas 与 story 同口径

`dispatch-canvas.ts` 与 `dispatch-story.ts` 须同步遵守 §3.1–3.5。Review 时 **成对检查**。

### 3.7 入队交通灯（序号 stagger）

QUEUED 创建时 **禁止** 对每条任务独立 `random(0, N)`（连点仍可能同秒 eligible）。

统一使用 [`queue-dispatch-after.ts`](../lib/generation/traffic-control/queue-dispatch-after.ts)：

```
dispatchAfter = now + queueIndex × 5000ms + random(0, 3000ms)
```

- `queueIndex` = 同 traffic scope 下、**insert 前**已有 `QUEUED` 条数（0-based）  
- 所有入队路径（admit / story-scope / engine-runner / story-task）须 `await compute*QueueDispatchAfter`  
- `recoverStaleDispatching` / revert 回 QUEUED 时用 `queueDispatchAfterFromIndex(i)` 错开，**禁止** `dispatchAfter = now` 或裸 `+ 2000`  
- `getDispatchBatch()` 默认 **5**（减轻单轮 poll 事务峰值）  
- 第二层 **车间距**（`sampleActorDispatchSpacingMs`）仍在 slot 失败 / actor spacing 时生效

---

## 4. 无 Gateway log 的正常阶段

`QUEUED` / `DISPATCHING` 在 `createTask` 成功前 **不会产生** `GatewayRequestLog`。  
诊断脚本：

```bash
pnpm --dir book-mall canvas:queued-reconcile --stale-min=5
pnpm --dir book-mall canvas:diagnose-missing-gateway-log   # 若已登记
```

---

## 5. 运维 Runbook（生产线卡死）

1. **确认排队**：`canvas:queued-reconcile` — 看 `queued` / `dispatching` / `staleCount`  
2. **对账 + 推进 dispatch**：`pnpm --dir book-mall generation:reconcile-traffic`  
3. **重启** book-mall 与 poll 进程（使新代码与连接池生效）  
4. **连接预算**：`DATABASE_URL` 含 `connection_limit`；见 `docs/dev.md`、`deploy/tencent/pgbouncer/README.md`  
5. **仅本地调试**：`TRAFFIC_CONTROL_OFF=1` 绕过队列（**禁止**生产长期开启）

---

## 6. Code Review Checklist

- [ ] 所有 dispatch `$transaction` 使用 `CANVAS_DB_TX_OPTIONS`  
- [ ] `maxConcurrency` 在 tx 外解析  
- [ ] 占槽路径使用 `runTxWithRetry`  
- [ ] DISPATCHING 异常有 revert（release + QUEUED）  
- [ ] 批次 loop 每任务独立 catch  
- [ ] story 与 canvas 已对齐  
- [ ] 未引入「整批一个 catch 跳过全部 QUEUED」  

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-22 | DB-Resilience-R1：503 重排队、poll 退避、queued-reconcile |
| 2026-06-24 | **recurrence**：dispatch 占槽 5s 超时 + tx 内 tenant 查询 + 批次 catch；规范固化 + canvas/story dispatch 修复 |
| 2026-06-24 | **queue stagger**：序号 ×5s + jitter 入队；recover/revert 错开；DISPATCH_BATCH 默认 5 |
