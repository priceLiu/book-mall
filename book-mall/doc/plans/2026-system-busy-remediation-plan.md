# DB-Resilience-R1 · Phase A–E 全量 Rollout 计划

> **代号**：`DB-Resilience-R1`  
> **Release 记录**：[`docs/releases/2026-06-db-resilience-r1.md`](../../../docs/releases/2026-06-db-resilience-r1.md)

---

## 总览

| Phase | 主题 | 代码 | 运维/架构 | 实施后解决什么 |
|-------|------|------|-----------|----------------|
| **A** | 扣费 / 失败码 | ✅ | 脚本可选 | **积分误标**、5s 事务超时误判 |
| **B** | dispatch / poll / 对账 | ✅ | — | **QUEUED 无 log**、poll **雪崩**、dispatch 静默失败 |
| **C** | 连接预算 | 文档 ✅ | ⏳ 你执行 | **dev:all 打满 CDB** |
| **D** | PgBouncer | 文档 ✅ | ⏳ 现网 | **生产多副本连接耗尽**（根治） |
| **E** | 预检 / poll 节流 | ✅ | env 可选 | **无效排队**、高负载 recordInfo 读 |

---

## Phase A — 扣费路径 ✅

| # | 任务 | 状态 | 验收 |
|---|------|------|------|
| A1 | `writeLedger` 30s + retry | ✅ | 扣费不再 5s timeout |
| A2 | `billing-failure-map.ts` | ✅ | 新失败 = SYSTEM_BUSY |
| A3 | UI reconcile 误标 | ✅ | 旧 log 显示系统繁忙 |
| A4 | `gateway:repair-insufficient-mislabel` | ✅ | `--apply` 洗库 |
| A5 | 单元测试 | ✅ | vitest 通过 |

**彻底解决**：误报积分不足 → 错误充值/客服成本。  
**不解决**：DB 仍忙（→ B/C/D）。

---

## Phase B — dispatch / poll ✅

| # | 任务 | 状态 | 验收 |
|---|------|------|------|
| B1 | canvas dispatch 503 → QUEUED | ✅ | 503 不 FAILED |
| B2 | story dispatch 对齐 | ✅ | 同上 |
| B3 | `fire-canvas-dispatch` 日志 | ✅ | 终端见 dispatched |
| B4 | poll-loop DB 退避 | ✅ | `db backoff` 日志 |
| B5 | Gateway Logs Canvas 排队 | ✅ | 表头计数 |
| B6 | `canvas:queued-reconcile` | ✅ | CLI 对账 |

**彻底解决**：poll P1001 雪崩；排队任务可观测。  
**不解决**：CDB 连接上限（→ D）。

---

## Phase C — 运维 ⏳（需执行）

| # | 任务 | 负责人 | 命令/操作 |
|---|------|--------|-----------|
| C1 | dev `connection_limit=10` | 开发 | 编辑 `book-mall/.env.local` DATABASE_URL |
| C2 | 改 env 后重启 | 开发 | 停 dev:all → 再起 |
| C3 | 减 poll 进程（可选） | 开发 | `pnpm dev:all:nopoll` 或单独起 mall |
| C4 | 洗历史误标 log | 运维 | `pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --apply` |
| C5 | 文档 | ✅ | `docs/dev.md` §数据库连接 |

**彻底解决**：本地「3 个视频就 busy」多数场景。  
**验收**：30min dev 会话 P1001 < 5 次/小时。

---

## Phase D — PgBouncer / 连接预算 ⏳（现网）

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| D1 | PgBouncer 部署文档 | ✅ | `deploy/tencent/pgbouncer/README.md` |
| D2 | 连接预算表 | ✅ | 见 PgBouncer README §连接预算 |
| D3 | 生产 DATABASE_URL 改 pooler | ⏳ | `?pgbouncer=true` 或独立端口 |
| D4 | 各服务 connection_limit 对齐 | ⏳ | book × N + poll × 1 ≤ pool_size |
| D5 | 读写分离（可选） |  backlog | Gateway 日志只读副本 |

**彻底解决**：生产多进程/多副本 **连接耗尽根因**。  
**验收**：CloudBase 多副本 + 3 poll worker，无 pool timeout 告警。

---

## Phase E — 增强 ✅

| # | 任务 | 状态 | 验收 |
|---|------|------|------|
| E1 | QUEUED 前 `assertCreditsBeforeGenerate` | ✅ | 真不足不占槽 |
| E2 | poll 批次间 `GENERATION_POLL_RECORD_PAUSE_MS` | ✅ | 设 200 降低读峰 |
| E3 | QUEUED 时 reserve | ❌ 不做 | 设计拒绝 |

**彻底解决**：无效排队、略降 poll DB 读峰。  
**不解决**：DB 连接池本身。

---

## 里程碑与依赖

```
Week 0（现在）
  ├─ A+B+E 代码合并
  ├─ C1–C2 本地重启验证
  └─ C4 洗历史 log（可选）

Week 1
  ├─ D3 PgBouncer 测试环境
  └─ 压测：6 路视频 + dev:all

Week 2+
  ├─ D3–D4 生产切 pooler
  └─ 监控：SYSTEM_BUSY 率、Canvas 排队 P99
```

---

## 组合效果（实施后）

| 里程碑 | 用户体验 |
|--------|----------|
| A 完成 | 不再被误导「积分不足」 |
| A+B+C | 本地 dev 可稳定跑视频生成 |
| +D 生产 | 「系统繁忙」降为偶发，可重试成功 |
| +E | 积分不足即时失败，排队更干净 |

**不能 100% 消除**：厂商 429、网络闪断、CDB 维护窗口。

---

## 相关命令速查

```bash
# 对账：排队无 log
pnpm --dir book-mall canvas:queued-reconcile -- --stale-min=2

# 洗误标 log
pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --dry-run
pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --apply

# 交通控流对账 + 推进 QUEUED
pnpm --dir book-mall generation:reconcile-traffic

# 高负载时略降 poll 读频率
GENERATION_POLL_RECORD_PAUSE_MS=200 pnpm canvas:poll-loop
```
