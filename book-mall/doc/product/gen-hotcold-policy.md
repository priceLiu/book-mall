# Gen-HotCold 动静分离 · 产品策略（R3）

权威技术发布说明见 [2026-07-16-gen-hotcold-r2.md](../releases/2026-07-16-gen-hotcold-r2.md)（R2 基础）与本文件（R3 一小时热区）。

## 1. 动 / 静定义

| 概念 | Gateway | 画布任务表 | 用户可见成品 |
|------|---------|------------|--------------|
| **动（热）** | 在飞 `PENDING/RUNNING` + `completedAt` 近 **1h** 终态 | 在飞 + 终态 `updatedAt` 近 **6h** | 不依赖任务行 |
| **静（冷）** | 终态且已过热窗 → `GatewayRequestLogArchive` 只读 | 二期归档（本版仅缩高频读窗） | `CanvasProject.canvas` JSON + OSS **长期保留** |

**平台范围**：画布 / 分镜 / 工具 / 电商等 **共用** `GatewayRequestLog` 热表；画布 `CanvasGenerationTask` 按项目隔离，策略更宽松。

## 2. Gateway 一小时热区

### 2.1 默认查询（`mode=live`）

- API 默认 `mode=live`，WHERE 附加热区：`在飞 OR completedAt ≥ now-1h`
- Gateway 控制台 **日志页 / 状态页** 默认「实时」；**历史** 走 `mode=history` + 日期范围（默认近 31 天）

### 2.2 归档搬家

- cron 每 **15–30 分钟**：`pnpm --dir book-mall hotcold:archive -- --only=gateway`
- 条件：终态且 `completedAt < now - GATEWAY_LOG_HOT_RETENTION_HOURS`（默认 1）
- 事务内 `INSERT 归档 ON CONFLICT DO NOTHING` + `DELETE 主表`（与 R2 相同，幂等）

### 2.3 轮询规则（无动不 poll）

| 场景 | opportunistic poll | 前端自动刷新 |
|------|-------------------|--------------|
| `mode=live` 且有在飞 / 预警 / 后台等待 | 可 `poll=1`（后台单飞，不阻塞 HTTP） | 有动数据时 8–10s |
| `mode=history` | **禁止**（`skip`） | **禁止** |
| 无在飞、无预警、无后台等待 | 不 poll | **停止**请求（不只 poll=0） |

实现：`log-read-poll-guard.ts`、`gateway-web/lib/gateway-live-poll-policy.ts`

## 3. 归档与财务分层

| 层 | 表 / 用途 | 保留 |
|----|-----------|------|
| 热主表 | `GatewayRequestLog` | 在飞 + 近 1h 终态 |
| 归档明细 | `GatewayRequestLogArchive` | 默认可查 24 个月（运维可延长） |
| 扣费账本 | `CreditLedger` | **365 天+**（与 Gateway 热窗独立） |

- **钱**：以 `CreditLedger` + `CreditAccount` 为准
- **调用明细佐证**：Gateway 热表 / 归档
- **财务跨月查询**：`findGatewayLogsByTimeRange` / `mode=history` 自动并读归档

## 4. 画布任务 vs 节点 JSON

- **打开画布**：`getCanvasProject` hydrate 整份 `project.canvas`；旧视频/图在节点 JSON + OSS
- **高频 `/tasks`**（`lightweight`）：仅扫在飞 + 近 6h 终态（`CANVAS_TASK_TERMINAL_HOT_HOURS`）
- **生成记录面板**：`listProjectGenerationRecords`，默认近 **30 天** 全字段
- 任务行瘦身 **不影响** 节点上已生成媒体

## 5. 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `GATEWAY_LOG_HOT_RETENTION_HOURS` | `1` | 主表热保留（本地可设 `24` 调试） |
| `GATEWAY_LOG_ARCHIVE_QUERY_RETENTION_DAYS` | `730` | 归档可查参考 |
| `CANVAS_TASK_TERMINAL_HOT_HOURS` | `6` | 画布任务高频读终态窗 |
| `CANVAS_OPPORTUNISTIC_POLL` | 关 | R2：读路径不重 poll（R3 延续） |

## 6. 部署步骤（R3 增量）

1. `pnpm --dir book-mall db:deploy`（无新迁移；复用 R2 归档表）
2. 部署 book-mall + gateway-web
3. `pnpm --dir book-mall gateway:stats-reconcile`（热区变更后纠偏投影）
4. `pnpm --dir book-mall hotcold:archive:dry-run` → 确认候选量 → 配置 cron
5. 生产 cron 示例：每 30 分钟 `hotcold:archive --only=gateway`

## 7. 手工验收清单

1. 无在飞时 Gateway 日志/状态页 **无周期性网络请求**
2. 有在飞时 delta + 后台 poll，HTTP **不阻塞 60s+**
3. 完成 **1h+** 的 log：实时 Tab 不可见，历史 Tab 可查
4. 重开画布：上周生成的视频仍在节点上
5. `hotcold:archive --dry-run` 候选量合理

## 8. 二期（未纳入 R3）

- `CanvasGenerationTaskArchive` + 30–90 天搬家
- `StoryGenerationTask` 缩热窗
- 月 rollup 固化表
- 原生月分区（R2 Phase 5B）
