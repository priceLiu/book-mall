# 生成任务 · 交通式控流与积分不卡死

> **状态**：已实施（见 [`2026-06-19-generation-traffic-control-rollout.md`](./2026-06-19-generation-traffic-control-rollout.md)）
> **日期**：2026-06-19  
> **范围**：book-mall Gateway、`CanvasGenerationTask` / `StoryGenerationTask`、poll worker、统一积分 RESERVE/SETTLE/RELEASE  
> **原则**：不用 Redis；控流像交通管理（信号灯 + 流速 + 车间距）；排队阶段 **不冻结积分**；任何终态必须释放槽位与账本。

---

## 1. 背景与问题

### 1.1 今天已出现的问题

| 现象 | 根因 |
|------|------|
| 画布节点长时间「生成中」 | SUBMITTED poll 慢 / 厂商慢 / 超时窗口 45min |
| 积分像被「扣死」 | Gateway log 仍为 `RUNNING`，`RESERVE` 未 `RELEASE`；或 Canvas 已 FAILED 与 Gateway 三态分裂 |
| 多人同时点生成 | 无租户级并发 enforcement（Redis 已移除）；火山 BYOK 撞墙 |

已有部分修复：`failGatewayLogIfStillRunning` + `recoverCanvasVolcengineTimedOutTask` + 45min 火山超时。但 **发起路径仍同步 RESERVE + 同步调厂商**，高峰时既伤厂商又易留下不一致状态。

### 1.2 目标

1. **≥20 人**同时生视频：系统可预测、可恢复，用户 **少看到 429**。
2. **积分**：只在「即将占用厂商」时 RESERVE；失败/超时/取消 **必 RELEASE**；排队 **不冻积分**。
3. **用户无感**：同用户 2～3s 间隔、租户级流速限制，UI 显示「准备中 / 排队中」而非硬拒绝。
4. **运维简单**：PostgreSQL 单写；可选对账 cron；默认少配 env。

### 1.3 非目标（本阶段不做）

- 引入 Redis / 新中间件
- 改造前端为长轮询 WebSocket（可 Phase 2 增强）
- 按秒实时计费（仍按现有 15s 封顶冻结 + SETTLE）

---

## 2. 交通隐喻 → 系统映射

```
                    ┌─────────────────────────────────────────┐
  用户点击生成  ──▶  │ ① 车间距（同 actor 2～3s）              │
                    │ ② 流速（租户 token bucket，如 1 条/2s）   │
                    │ ③ 信号灯（RUNNING 视频 ≤ maxConcurrency）│
                    └─────────────────┬───────────────────────┘
                                      │ 出队 dispatch
                                      ▼
                    createRequestLog → RESERVE → 调厂商 → SUBMITTED
                                      │
                    成功 ──▶ SETTLE + 释放槽
                    失败 ──▶ RELEASE + 释放槽
                    超时 ──▶ failGatewayLog + RELEASE + 释放槽
```

| 交通概念 | 实现名 | 存储 | 用户可见 |
|---------|--------|------|----------|
| 排队等红灯 | `QUEUED` | `CanvasGenerationTask.status` | 「排队中（前面 N 个）」 |
| 占用车道 | `RUNNING` 槽 | `GenerationTrafficState.runningCount` + 对账 | 无（仍显示生成中） |
| 流速限制 | Token bucket | `GenerationTrafficState.tokens` + `lastTokenAt` | 2～3s「准备中」 |
| 车间距 | Actor spacing | `GenerationTrafficState.lastActorSubmitAt` | 无感 |
| 收费站 | RESERVE | `CreditLedger` `reserve:<logId>` | 可用积分略减（冻结） |

---

## 3. 任务状态机（Canvas / Story 对齐）

### 3.1 现状

```
PENDING ──(同步/ poll 重试 createTask)──▶ SUBMITTED ──▶ SUCCEEDED | FAILED
```

- `PENDING` 混用了「等重试」与「刚创建」语义。
- Gateway 在 `createRequestLog` 内 **立即** RESERVE（视频）。

### 3.2 目标态

```
QUEUED ──(dispatch worker 出队)──▶ DISPATCHING ──▶ SUBMITTED ──▶ SUCCEEDED | FAILED | CANCELLED
         │                              │
         │                              └─ 失败回 QUEUED（可重试）或 FAILED
         └─ 用户取消 / 排队超时 → CANCELLED（无 RESERVE）
```

| 状态 | Gateway log | 积分 | 占并发槽 |
|------|-------------|------|----------|
| `QUEUED` | 无 | **无** | 否 |
| `DISPATCHING` | 创建中 | RESERVE 在此刻 | 预占（事务内 +1） |
| `SUBMITTED` | `RUNNING` | 已 RESERVE | 是 |
| 终态 | `SUCCEEDED`/`FAILED` | SETTLE / RELEASE | 释放 |

**兼容**：旧 `PENDING`（已创建、等 poll 重试）在迁移期视为「待 dispatch 的 SUBMIT 失败重试」，**不**走 QUEUED；新视频任务一律 `QUEUED` 起步。

**Prisma**：`CanvasGenerationStatus` / `StoryGenerationStatus` 增加 `QUEUED`、`DISPATCHING`（或 `DISPATCHING` 仅用短生命周期 + advisory lock，不落库超过 30s）。

### 3.3 推荐：DISPATCHING 尽量短

- 在单 DB 事务内：`占槽 → createRequestLog → reserveVideoCreditsForLog → HTTP 调厂商`。
- 成功则 `SUBMITTED`；HTTP 失败则 `RELEASE`（若已 reserve）+ 释放槽 + `QUEUED`（退避）或 `FAILED`。
- 避免长时间 DISPATCHING；超过 60s 的对账 job 回滚槽位。

---

## 4. 控流三层（PostgreSQL）

### 4.1 数据模型（新增）

```prisma
/// 租户或个人空间的生成交通状态（Single Writer：book-mall）
model GenerationTrafficState {
  /// TEAM → tenantId；个人 → `user:<userId>`
  scopeKey           String   @id
  ownerType          String   // USER | TENANT
  ownerId            String

  /// 信号灯：当前 SUBMITTED 视频占用数（与 Gateway RUNNING 对账）
  runningVideoCount  Int      @default(0)

  /// 流速：token bucket
  dispatchTokens     Float    @default(0)
  lastTokenRefillAt  DateTime @default(now())

  /// 车间距：该 scope 下任意 actor 上次 dispatch 时间
  lastDispatchAt     DateTime?

  maxConcurrency     Int      @default(2)  // 镜像 Tenant.maxConcurrency 或个人默认
  tokensPerSec       Float    @default(0.5) // 默认每 2s 1 个 token

  updatedAt          DateTime @updatedAt

  @@index([ownerType, ownerId])
}
```

**scopeKey 规则**：

- 团队生成：`tenant:<tenantId>`
- 个人 BYOK/积分：`user:<bookUserId>`

任务表增加（可选，便于排序）：

```prisma
// CanvasGenerationTask / StoryGenerationTask
queuedAt      DateTime?
dispatchAfter DateTime?  // 车间距 / 退避
priority      Int        @default(0)  // 未来 VIP；默认 FIFO
tenantId      String?    // 冗余，便于按租户扫 QUEUED
actorUserId   String?
```

### 4.2 ① 车间距（Actor spacing）

**规则**：同一 `actorUserId` 两次 **dispatch**（非点击）间隔 ≥ `ACTOR_DISPATCH_MIN_MS`（默认 **2500ms**）。

**实现**：

```sql
-- dispatch 前
SELECT lastDispatchAt FROM GenerationTrafficState WHERE scopeKey = $1 FOR UPDATE;
-- if now - lastDispatchAt < 2500ms → 该任务 dispatchAfter = lastDispatchAt + 2500ms，本轮跳过
```

点击生成 **立即** 创建 `QUEUED` 任务并返回； spacing 在 **dispatch worker** 执行，用户只感到稍晚开始，不会 429。

### 4.3 ② 流速（Token bucket）

**规则**：每个 scope 补充速率 `tokensPerSec = 0.5`（每 2s 1 个 token），桶容量 `burst = max(2, maxConcurrency / 4)`。

**出队条件**：`tokens >= 1` 且 ③ 信号灯未满。

**实现**（事务内）：

```
elapsed = now - lastTokenRefillAt
tokens = min(burst, tokens + elapsed * tokensPerSec)
if tokens >= 1: tokens -= 1; allow dispatch
```

20 人同时点击 → 前 2～4 个立即出队，其余每 ~2s 放行 1 个，**峰值被抹平**。

### 4.4 ③ 信号灯（并发上限）

**规则**：

- 团队：`maxConcurrency = Tenant.maxConcurrency`（已有 `resolveDefaultTeamMaxConcurrency`）
- 个人视频：默认 **2**（`VIDEO_MAX_CONCURRENCY`）

**占槽**：

```sql
UPDATE GenerationTrafficState
SET runningVideoCount = runningVideoCount + 1
WHERE scopeKey = $1 AND runningVideoCount < maxConcurrency
RETURNING *;
-- 0 rows → 任务保持 QUEUED，下轮 poll 再试
```

**释放**（`finalizeRequestLog` / 任务终态 / 超时）：

```sql
UPDATE GenerationTrafficState
SET runningVideoCount = GREATEST(0, runningVideoCount - 1)
WHERE scopeKey = $1;
```

**对账**（cron，每 5min）：

```sql
runningVideoCount = COUNT GatewayRequestLog
  WHERE tenantId/actor 匹配 AND requestKind=VIDEO AND status=RUNNING
```

以 Gateway 为真值校正，防止进程崩溃泄漏。

---

## 5. 积分生命周期（不卡死 invariant）

### 5.1 铁律

| # | Invariant |
|---|-----------|
| I1 | `QUEUED` 任务 **禁止** 出现 `reserve:<logId>` 流水 |
| I2 | 每个 `RESERVE` 必须在 **46min 内** 对应 `SETTLE` 或 `RELEASE`（火山 45min + 余量） |
| I3 | Canvas/Story 任务终态与 Gateway log 终态 **同一事务或同一 finalize 链** 触发 RELEASE |
| I4 | `reservedCredits` 账户字段 = ledger 聚合；对账 cron 修正 |

### 5.2 时序（视频）

```
[用户点击]
  assertCreditsBeforeGenerate()     // 仅检查 balance ≥ 1 条最小价，不 RESERVE
  create task QUEUED

[dispatch worker 出队]
  acquireTrafficSlot()              // 信号灯 + token + spacing
  log = createRequestLog()          // 仍 RUNNING
  reserveVideoCreditsForLog(log)    // ★ 冻结移到这里
  vendor HTTP
  task → SUBMITTED

[poll 成功]
  finalize SUCCEEDED → settleReserved

[poll 失败 / 超时]
  failGatewayLogIfStillRunning → finalize FAILED → releaseReserved
  releaseTrafficSlot()
```

### 5.3 排队超时（防无限 QUEUED）

- `QUEUED` 超过 **10min** 未 dispatch → `CANCELLED`，原因 `QUEUE_TIMEOUT`。
- 不 RESERVE；通知前端「排队超时，请重试」。

### 5.4 对账 cron（`scripts/reconcile-generation-traffic.ts`）

每 5～10min：

1. **幽灵 RESERVE**：`RUNNING` log 超过阈值无 task / task 已 FAILED → `releaseReserved`
2. **槽位泄漏**：`runningVideoCount` vs 实际 `RUNNING` 视频 log
3. **DISPATCHING 僵尸**：`DISPATCHING` > 60s → 释放槽、标记 FAILED 或回 QUEUED

输出指标到日志 / 管理后台（可选）。

---

## 6. 模块划分

```
book-mall/lib/generation/traffic-control/
  scope-key.ts              # tenant vs user scopeKey
  traffic-state.ts          # load/lock GenerationTrafficState
  actor-spacing.ts          # 2～3s 间隔
  token-bucket.ts           # 流速
  concurrency-slot.ts       # 信号灯 acquire/release
  admit.ts                  # enqueue：校验 inflight + 写 QUEUED
  dispatch.ts               # 出队 + createRequestLog + reserve + vendor
  reconcile.ts              # 对账
  constants.ts              # 默认 2500ms、0.5 token/s 等
```

### 6.1 接入点

| 现有入口 | 变更 |
|---------|------|
| `canvas-engine-runner` 视频分支 | 创建 `QUEUED` 而非直接调 `canvasGwCreate*Job` |
| `canvas-task-service.runCanvasPollWorker` | 每轮开头 `dispatchQueuedCanvasTasks(batch)` |
| `story-task-service.runPollWorker` | 同上 |
| `proxy-common.createRequestLog` | 视频 RESERVE **保留**，但仅由 `dispatch.ts` 调用 |
| `proxy-common.finalizeRequestLog` | 失败/成功末尾 `releaseTrafficSlot(scopeKey)` |
| `fail-gateway-log-on-timeout.ts` | 已有 RELEASE；补 `releaseTrafficSlot` |

### 6.2 Gateway 与任务表关系

- **仍** 一任务一 `GatewayRequestLog`（审计、结算不变）。
- `gatewayLogId` 仅在 `DISPATCHING` 之后写入 `inputPayload`。
- 团队维度：`createRequestLog` 继续传 `tenantId` / `actorBookUserId`。

---

## 7. API / 前端契约

### 7.1 提交响应（200）

```json
{
  "task": {
    "id": "...",
    "status": "QUEUED",
    "queuePosition": 3,
    "estimatedWaitSec": 6
  }
}
```

- `queuePosition`：同 scope 下 `QUEUED` 且 `queuedAt` 更早的数量 + 1。
- `estimatedWaitSec`：`queuePosition * 2`（粗估，可后续用 token 模型精算）。

### 7.2 轮询 / SSE（现有项目 GET）

任务状态增加：

| status | UI 文案 |
|--------|---------|
| `QUEUED` | 排队中… |
| `DISPATCHING` | 准备生成… |
| `SUBMITTED` | 生成中（现有扫光） |

**积分提示**：`QUEUED` 时不显示「已冻结 N 积分」；进入 `SUBMITTED` 后显示冻结额（与现网一致）。

### 7.3 错误码

| HTTP | code | 含义 |
|------|------|------|
| 402 | `INSUFFICIENT_CREDITS` | 余额不足（预检） |
| 409 | `PROJECT_INFLIGHT_LIMIT` | 单画布 5 条（现有） |
| 409 | `USER_INFLIGHT_LIMIT` | 用户总 inflight 50（现有） |
| **不再** | `CONCURRENCY_LIMIT` 429 | 改为 QUEUED，避免硬拒 |

---

## 8. 默认参数（少配 env）

| 参数 | 默认 | 说明 |
|------|------|------|
| `ACTOR_DISPATCH_MIN_MS` | 2500 | 同用户 dispatch 间隔 |
| `TRAFFIC_TOKENS_PER_SEC` | 0.5 | 每 2s 放行 1 条 |
| `TRAFFIC_TOKEN_BURST` | auto | `max(2, maxConcurrency/4)` |
| `QUEUE_TIMEOUT_MIN` | 10 | QUEUED 最长等待 |
| `DISPATCH_BATCH` | 10 | 每轮 poll 最多 dispatch 条数 |
| 团队 `maxConcurrency` | 席位数，≥20 保底 20 | 已有 `team-concurrency.ts` |
| 个人视频并发 | 2 | 已有 `VIDEO_MAX_CONCURRENCY` |

---

## 9. 分阶段落地

### Phase 0 — 积分不卡死（1～2 天，**优先**）

不改 QUEUED，只加固 invariant：

- [ ] `finalizeRequestLog` / `failGatewayLogIfStillRunning` 后 **必** 调 `releaseTrafficSlot`（可先 no-op）
- [ ] 新增 `reconcile-generation-traffic.ts`：扫 RUNNING 超时 log → RELEASE
- [ ] 集成测试：超时路径 TC — Canvas FAILED + ledger RELEASE

**验收**：人为制造超时后，`reservedCredits` 回到点击前。

### Phase 1 — QUEUED + 延迟 RESERVE（3～5 天）

- [ ] Migration：`QUEUED`/`DISPATCHING` + `GenerationTrafficState`
- [ ] 视频走 `admit → QUEUED`；poll worker `dispatch`
- [ ] RESERVE 移到 dispatch 内
- [ ] 前端：QUEUED 文案 + queuePosition

**验收**：20 人同时点 → 全部 QUEUED/SUBMITTED，无 429；排队期间可用积分不变。

### Phase 2 — 三层交通（2～3 天）

- [ ] Token bucket + actor spacing
- [ ] 信号灯与 `Tenant.maxConcurrency` 联动
- [ ] 对账 cron 部署（SCF 或 sidecar）

**验收**：压测 20 并发 submit，厂商 QPS 平滑；`runningVideoCount` 不超过 max。

### Phase 3 — Story / 电商 / 图像（按需）

- Story 分镜视频对齐同一 `dispatch.ts`
- 图像是否 QUEUED：默认 **否**（图像快、不占长槽）；仅 VIDEO 走交通层

---

## 10. 监控与告警

| 指标 | 阈值建议 |
|------|----------|
| `QUEUED` 任务数（按 tenant） | > 50 持续 5min 告警 |
| `runningVideoCount` 对账偏差 | ≠ 0 告警 |
| RESERVE 无 SETTLE/RELEASE 超过 46min | > 0 告警 |
| dispatch 失败率 | > 5% 告警 |

---

## 11. 风险与回退

| 风险 | 缓解 |
|------|------|
| dispatch 与 poll 竞态 | `FOR UPDATE` scope 行；任务 `DISPATCHING` 单飞 claim |
| 双写槽位与 log 不一致 | 对账 cron；以 Gateway RUNNING 为准 |
| 用户觉得「点了没反应」 | QUEUED 必须返回 queuePosition；2～3s 内变 DISPATCHING |
| 回退 | env `TRAFFIC_CONTROL_OFF=1` → 跳过 QUEUED，恢复同步 submit（Phase 1 起保留开关） |

---

## 12. 与现有文档关系

- 并发默认值、poll 参数：`docs/100人团队扩展方案.md`
- 积分 RESERVE/SETTLE/RELEASE：`lib/billing/gateway-credit-settlement.ts`、`doc/finance/finance-rule-v1.0.md`
- 超时恢复：`lib/canvas/canvas-volcengine-recover.ts`、`lib/gateway/fail-gateway-log-on-timeout.ts`
- 团队席位数并发：`lib/tenant/team-concurrency.ts`

---

## 13. 变更记录

| 日期 | 内容 |
|------|------|
| 2026-06-19 | 初稿：交通式三层控流 + QUEUED 延迟 RESERVE + PG 实现 + 分阶段 |
