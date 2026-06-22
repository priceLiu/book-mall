# 腾讯云 PostgreSQL · PgBouncer 连接池（Phase D）

> **DB-Resilience-R1** 生产级连接治理。本地 dev 可仅用 `connection_limit`（Phase C）；**现网多副本必上 pooler**。

---

## 为什么需要

| 直连 CDB | 经 PgBouncer |
|----------|--------------|
| 每进程 Prisma 池 N 连接 | 多进程共享 M 条真实连接（M ≪ ΣN） |
| dev:all 8 进程 × 20 = 160 连接风险 | pool_size=50 即可支撑 |
| `Server has closed the connection` 频繁 | 连接复用、断线重连由 pooler 处理 |

---

## 推荐拓扑

```
book-mall × replicas ──┐
canvas/story/gateway   ├──► PgBouncer (transaction mode) ──► 腾讯云 PostgreSQL
poll workers × 3 ──────┘
```

- **Pool mode**：`transaction`（Prisma 兼容；migrate 走 **direct** 连接）
- **Pool size**：建议 CDB `max_connections` 的 60–70%
- **Client 连接**：各容器 `connection_limit` 之和 ≤ pool_size

---

## 连接预算表（示例：CDB max_connections=100）

| 进程 | 副本数 | PRISMA / URL limit | 小计 |
|------|--------|-------------------|------|
| book-mall (web) | 2 | 15 | 30 |
| canvas-web BFF | 1 | 5 | 5 |
| story-poll-loop | 1 | 1 | 1 |
| canvas-poll-loop | 1 | 1 | 1 |
| gateway-poll-loop | 1 | 1 | 1 |
| **预留 migrate/admin** | — | — | 10 |
| **PgBouncer pool_size** | — | — | **≤ 60** |

调参原则：`副本数 × connection_limit + poll进程数 × 1 + 10` ≤ PgBouncer `max_client_conn`；`pool_size` ≤ CDB 上限。

---

## DATABASE_URL 示例

**应用运行时（经 PgBouncer）**：

```
postgresql://USER:PASS@pgbouncer.internal:6432/tool_mall?sslmode=require&pgbouncer=true&connection_limit=15&pool_timeout=30&connect_timeout=15
```

**迁移专用（直连 CDB，仅 CI/运维）**：

```
postgresql://USER:PASS@sh-postgres-xxx.tencentcdb.com:24155/tool_mall?sslmode=require&connect_timeout=30
```

Prisma：`pnpm db:deploy` 使用 `DIRECT_DATABASE_URL`（若配置）或临时切直连。

---

## 部署步骤（ checklist ）

- [ ] 在 CDB 同 VPC 部署 PgBouncer（CVM / TKE sidecar / 腾讯云数据库代理若可用）
- [ ] `pool_mode = transaction`，`default_pool_size = 50`
- [ ] 应用 `DATABASE_URL` 指向 PgBouncer；`connection_limit` 按上表
- [ ] poll-loop 保持 `PRISMA_CONNECTION_LIMIT=1`（package.json 已设）
- [ ] 灰度 1 副本 → 观察 `SYSTEM_BUSY` / P1001 → 全量
- [ ] 更新 `deploy/tencent/book-mall.env` 与 CloudBase 环境变量

---

## 验收

- CloudBase 全副本 + 3 poll worker 运行 24h，无 `Timed out fetching a new connection`
- Gateway Logs `SYSTEM_BUSY` 率较直连下降 >80%
- Canvas「排队」P99 等待 < 2min（槽位正常时）

---

## 参考

- Neon 模式（已写在 `book-mall/.env.example`）：`-pooler` 主机 + `pgbouncer=true`
- 全站端口/进程：`docs/全站架构图与配置表.md` §2
- Release：`docs/releases/2026-06-db-resilience-r1.md`
