# DB-Resilience-R1 · 生成管线 DB 韧性（2026-06-22）

> **代号**：`DB-Resilience-R1`  
> **Rollout 计划**：`book-mall/doc/plans/2026-system-busy-remediation-plan.md`  
> **解决的三类关键问题**见下文。

---

## 命名与范围

| 项 | 说明 |
|----|------|
| **代号** | `DB-Resilience-R1`（Generation DB Resilience Release 1） |
| **范围** | book-mall 扣费 / 交通控流 dispatch / poll-loop / Gateway 日志展示 / gateway-web |
| **不含** | 腾讯云 PgBouncer 实例部署（Phase D 运维 checklist，见 `deploy/tencent/pgbouncer/README.md`） |

---

## 解决的关键问题

### P1 · 积分误标（用户最痛）

**现象**：`failCode: INSUFFICIENT_CREDITS`，`failMessage` 却是 Prisma `Transaction already closed` / `creditLedger.create` 超时。

**根因**：DB 连接池排队导致 5s 默认事务超时；旧逻辑统一标成积分不足。

**R1 措施**：

- `writeLedger` → 30s 事务 + `runTxWithRetry`
- `billing-failure-map.ts` → 新失败写 `SYSTEM_BUSY`
- UI 展示纠正 + `gateway:repair-insufficient-mislabel` 洗历史

### P2 · 画布「生成中」但无 Gateway log

**现象**：Logs 只有 3 条 RUNNING，新点击无 log；Canvas 排队列有数。

**根因**：任务停在 `QUEUED`/`DISPATCHING`；dispatch 503 被误 FAILED；poll 雪崩占满连接。

**R1 措施**：

- dispatch 503 → 退回 `QUEUED`（canvas + story）
- `fire-canvas-dispatch` 可观测
- poll-loop DB 指数退避
- Gateway Logs「Canvas 排队」列 + `canvas:queued-reconcile`

### P3 · dev:all 终端 P1001 / connection closed

**现象**：`Can't reach database server`、`Server has closed the connection`，story/gateway-poll 刷屏。

**根因**：多进程直连腾讯云 CDB，无连接池代理，连接数 > 上限。

**R1 措施（代码侧）**：poll 退避、poll 并行度按 `connection_limit` 封顶、连接级 query 重试。  
**R1 措施（运维侧 Phase C/D）**：`connection_limit`、PgBouncer、连接预算表。

---

## 变更文件清单（按 Phase）

### Phase A — 扣费 / 失败码

| 文件 | 变更 |
|------|------|
| `lib/billing/billing-failure-map.ts` | **新增** 失败码归口 |
| `lib/billing/credit-account-service.ts` | `BILLING_DB_TX_OPTIONS` + `runTxWithRetry` |
| `lib/gateway/proxy-common.ts` | createRequestLog 用新映射 |
| `lib/gateway/log-fail-code.ts` | 误标 reconcile |
| `gateway-web/lib/gateway-log-fail.ts` | 前端展示对齐 |
| `scripts/repair-gateway-log-insufficient-mislabel.ts` | **新增** 历史修复 |
| `test/unit/billing-failure-map.test.ts` | **新增** |

### Phase B — dispatch / poll / 对账

| 文件 | 变更 |
|------|------|
| `lib/db-tx-retry.ts` | `isTransientSystemBusyError` |
| `lib/generation/traffic-control/dispatch-canvas.ts` | 503 重排队 |
| `lib/generation/traffic-control/dispatch-story.ts` | 同上 + submitted 写重试 |
| `lib/generation/traffic-control/fire-canvas-dispatch.ts` | **新增** |
| `lib/db-poll-backoff.ts` | **新增** |
| `scripts/{story,canvas,gateway}-poll-loop.ts` | DB 退避 |
| `lib/canvas/canvas-queue-without-log.ts` | **新增** |
| `app/api/gateway/logs/canvas-queue/route.ts` | **新增** |
| `gateway-web/components/logs/logs-table.tsx` | Canvas 排队列 |

### Phase C — 运维（文档 + 脚本）

| 文件 | 变更 |
|------|------|
| `docs/dev.md` | DATABASE_URL / dev:all 连接预算 |
| `deploy/tencent/book-mall.env.example` | 已有 connection_limit 说明 |
| `scripts/canvas-queued-reconcile.ts` | **新增** |
| `package.json` | `canvas:queued-reconcile` · `gateway:repair-insufficient-mislabel` |

### Phase D — 架构（文档 + 预算表）

| 文件 | 变更 |
|------|------|
| `deploy/tencent/pgbouncer/README.md` | **新增** PgBouncer 部署与连接预算 |
| `docs/全站架构图与配置表.md` §7 | 变更记录 |

### Phase E — 增强

| 文件 | 变更 |
|------|------|
| `lib/generation/traffic-control/video-queue-precheck.ts` | **新增** QUEUED 前积分预检 |
| `lib/canvas/canvas-engine-runner.ts` | 接入预检 |
| `lib/generation/poll-config.ts` | `GENERATION_POLL_RECORD_PAUSE_MS` |
| `lib/canvas/canvas-task-service.ts` | poll 批次间节流 |

---

## 部署后必做（Phase C checklist）

1. `.env.local` / 生产 `DATABASE_URL` 加 `connection_limit=10`（dev）或 `20`（单容器生产）
2. **重启**所有 book-mall / poll 进程
3. 可选：`pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --apply`
4. 生产：按 `deploy/tencent/pgbouncer/README.md` 上 PgBouncer

---

## 验收

- [ ] 压库时新 log 为 `SYSTEM_BUSY`，非 `INSUFFICIENT_CREDITS`
- [ ] 余额充足用户不再被引导充值
- [ ] poll 终端出现 `db backoff`，P1001 频率下降
- [ ] Gateway Logs「Canvas 排队」与 `canvas:queued-reconcile` 一致
- [ ] 积分不足在 QUEUED 前即 FAILED（Phase E）
- [ ] 生产 PgBouncer 上线后 connection 错误接近零
