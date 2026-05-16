# 腾讯云 PostgreSQL（tool_mall）

## 连接

- 应用通过 **`DATABASE_URL`**（`book-mall/.env.local`）连接；逻辑库名 **`tool_mall`**。
- Prisma 使用直连 URL；腾讯云是否要求 TLS 以控制台为准（`sslmode=require` 或 `disable`）。

## 首次建表

在 **`book-mall`** 目录：

```bash
pnpm run db:deploy
```

确保运行环境能访问 `*.sql.tencentcdb.com`（本机需放行出口或使用 VPN / 同 VPC）。

## 可选种子数据

空库首次部署后可：

```bash
pnpm run db:seed
```

（管理员邮箱依赖 `.env.local` 的 `ADMIN_EMAILS`。）

## 从 Neon 迁数据

1. 旧库：`pg_dump`（schema + data）。
2. 新库：恢复到 `tool_mall`，再核对序列与权限。
3. 切换 `DATABASE_URL` 后重启应用。

详见仓库根目录 **`issue.md`**（敏感信息，默认 gitignore）。

---

## 故障档案 · Prisma CLI `P1001` 但 PrismaClient 可连（2026-05-16）

**现象**：`pnpm db:deploy` 反复报

```
Error: P1001: Can't reach database server at `sh-postgres-*.sql.tencentcdb.com:24155`
```

但同机 `nc -zv host port` 成功、`PrismaClient.$queryRaw\`select 1\`` 也成功；线上服务也能正常连库。多次重启、`sslmode=require` / `disable` 切换均无改善。

**根因**：Prisma CLI 的 **schema engine**（用于 `migrate deploy` / `db push` 等）与运行时的 **query engine** 是两套二进制，对 IPv6/DNS/超时的处理不同；在某些 macOS / 网络环境下 schema engine 会偶发解析或握手失败，导致 P1001，**与数据库实例本身、`.env.local` 写法都无关**。

**临时解法（已落地为脚本）**：用 PrismaClient 直接把未应用的 migration SQL 跑到数据库，并补 `_prisma_migrations` 记录（含 SHA-256 校验和）。

```bash
cd book-mall
pnpm db:apply-pending
```

实现位于 `book-mall/scripts/apply-pending-migrations.ts`：

- 按 timestamp 顺序扫 `prisma/migrations/`；
- 与 `_prisma_migrations` 表（`finished_at IS NOT NULL AND rolled_back_at IS NULL`）取差集；
- 在事务里：逐条 `;` 拆分执行 SQL，并写入 / 更新 `_prisma_migrations`；
- 与 `prisma migrate deploy` 等效；之后从可连的环境再跑 `migrate status` 不会失配。

**长期方向（可选）**：

- 让本机出口 IP 进入腾讯云访问策略后，仍优先使用 `pnpm db:deploy`；`db:apply-pending` 作为「CLI 不可用时的应急通道」。
- 若长期遇到，再考虑升级 Prisma / 替换 schema engine 路径。

**当时跨过的迁移**：

- `20260516180000_tool_billing_detail_line`
- `20260528130000_tool_billing_line_internal_pricing_snapshot`
- `20260528150000_tool_billing_line_pricing_template_key`
