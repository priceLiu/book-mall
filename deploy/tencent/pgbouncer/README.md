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

## 本地 dev（Colima / Docker Desktop）

与正式环境同一套 **transaction 池**，验证整条链路后再上 CloudBase。

### 国内网络：镜像加速 + 本地 build

Docker Hub 直连慢/超时时，**可以**用国内 registry mirror；`edoburu/pgbouncer` 在多数加速站**没有缓存**，因此本地用 **`Dockerfile` + Alpine（走加速站）** 构建，不拉第三方 PgBouncer 镜像。

**Colima 配置加速（一次性）**：编辑 `~/.colima/default/colima.yaml`，将 `docker: {}` 改为：

```yaml
docker:
  registry-mirrors:
    - https://docker.1ms.run
    - https://mirror.ccs.tencentyun.com
```

然后 `colima stop && colima start`。验证：`docker info | grep -A3 "Registry Mirrors"`。

`start-local.sh` 会执行 `docker compose up -d --build`（`Dockerfile` 默认基础镜像 `docker.1ms.run/library/alpine:3.20`）。

```bash
# 1) 起 Docker（macOS Colima，建议已配上方 mirror）
colima start

# 2) 起 PgBouncer（自动从 book-mall/.env.local 同步 userlist）
./deploy/tencent/pgbouncer/start-local.sh

# 3) 将 book-mall/.env.local 的 DATABASE_URL 改为 127.0.0.1:6432 + pgbouncer=true
#    DIRECT_DATABASE_URL 保持直连 CDB:24155
# 4) 重启 dev 栈
pnpm dev:all:clean

# 停止池
./deploy/tencent/pgbouncer/stop-local.sh
```

**macOS 注意**：`brew install pgbouncer` 安装的 1.25.x 连**远程** CDB 时可能触发 async connect `Bad file descriptor`（本机 :6432 可监听但后端连不上）。本地 dev 若 Docker Hub 不可达，**暂用直连** `DATABASE_URL`（`connection_limit=30`）即可；**生产在 VPC 内用 Docker 部署 PgBouncer** 不受影响。

未起 PgBouncer 时不要使用 `127.0.0.1:6432` 的 `DATABASE_URL`。

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

## 应用侧改动（已在仓库落地）

- `book-mall/prisma/schema.prisma` 的 `datasource` 已加 **`directUrl = env("DIRECT_DATABASE_URL")`**。
  - 运行时(查询)走 `DATABASE_URL`(PgBouncer);**迁移/introspect 走 `DIRECT_DATABASE_URL`(直连)**。
  - `prisma migrate` / `pnpm db:deploy` 会**自动**使用 `directUrl`,无需手工切换。
- 各 `deploy/tencent/*.env.example` 与 `book-mall/.env.example` 已补 `DIRECT_DATABASE_URL`。
- 无 PgBouncer 时 `DIRECT_DATABASE_URL` 填与 `DATABASE_URL` 同库的直连串即可,行为不变。

## 本目录提供的部署文件

| 文件 | 用途 |
|------|------|
| `pgbouncer.ini` | transaction 模式池配置(已含 `ignore_startup_parameters`、空闲回收 `server_idle_timeout=120`) |
| `userlist.txt.example` | md5 认证清单模板(复制为 `userlist.txt` 填真实哈希,勿提交) |
| `docker-compose.yml` | 在 CDB 同 VPC 节点一键起 PgBouncer(`edoburu/pgbouncer`) |

## DATABASE_URL 示例

**应用运行时（经 PgBouncer，务必带 `pgbouncer=true`）**：

```
postgresql://USER:PASS@pgbouncer.internal:6432/tool_mall?sslmode=require&pgbouncer=true&connection_limit=15&pool_timeout=30&connect_timeout=15
```

**迁移专用 `DIRECT_DATABASE_URL`（直连 CDB:24155）**：

```
postgresql://USER:PASS@sh-postgres-xxx.tencentcdb.com:24155/tool_mall?sslmode=require&connect_timeout=30
```

---

## 部署步骤（ checklist ）

- [ ] 在 CDB 同 VPC 节点部署 PgBouncer：`cp userlist.txt.example userlist.txt`(填真实 md5) → 核对 `pgbouncer.ini` 的 `[databases]` host/port → `docker compose up -d`
- [ ] 健康检查：`psql "host=<node> port=6432 dbname=pgbouncer user=pgbouncer_admin" -c "SHOW POOLS;"`
- [ ] CloudBase/容器环境变量：`DATABASE_URL` → PgBouncer:6432(`pgbouncer=true`)；`DIRECT_DATABASE_URL` → 直连 CDB:24155
- [ ] `connection_limit` 按上方预算表（副本数×limit + poll×1 + 预留 ≤ `default_pool_size`）
- [ ] poll-loop 保持 `PRISMA_CONNECTION_LIMIT=1`（package.json 已设）
- [ ] 灰度 1 副本 → 观察 `SYSTEM_BUSY` / P1001 / `Server has closed` → 全量
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
