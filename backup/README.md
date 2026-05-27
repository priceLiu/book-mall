# 数据库备份说明（Gateway 迁移前）

迁移 `20260526130000_gateway_byok_tables` **已成功应用**（仅新增表，未改现有业务表）。

## 逻辑备份（本机）

```bash
bash scripts/backup-db.sh
```

若 `pg_dump` 报 pooler/连接错误，请在 **腾讯云控制台 → PostgreSQL → 手动备份** 打快照（推荐生产环境）。

## 还原（灾难恢复，须明确授权）

- 腾讯云控制台：回档到备份点
- 或 `pg_restore -d "$DATABASE_URL" backup/pre-gateway-XXXX.dump`

## 2026-05-26 本机 pg_dump 尝试

- 已安装 `libpq`（`brew install libpq`）
- 使用 book-mall `.env.local` 的 `DATABASE_URL` 连接腾讯云失败：`Bad file descriptor`（可能与网络/连接串有关）
- **请在腾讯云控制台补做一次手动备份作为基线**
