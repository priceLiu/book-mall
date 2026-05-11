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
