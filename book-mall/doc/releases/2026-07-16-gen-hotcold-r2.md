# Gen-HotCold-R2：生成链路动静分离与数据库抗压

发布日期：2026-07-16
代号：**Gen-HotCold-R2**

## 背景与问题

并发生成（如同一项目 8 条视频）上来时，整套 Gateway / Canvas 出现「卡死」、HTTP 500、状态页「生成中」数与实际不符。根因集中在数据库争用：

1. `poll` / `dispatch` / 队列扫描随大表增长退化为近全表扫描。
2. 读页面（日志页 / 状态页 / 画布）触发重 poll，把连接池打满，与「点生成」抢连接（越看越卡）。
3. 同一 `CreditAccount` 行的并发 reserve/settle 互相重试雪崩（P2034 → SYSTEM_BUSY → 500）。
4. 状态页卡片每次对 `GatewayRequestLog` 全表 `groupBy`，大表下昂贵且放大压力。
5. 主表只增不减，历史数据拖累一切热路径。

思路（用户提出）：**动静分离**——只有「当下在飞 + 近期」是动数据，其余皆历史；按此做投影 + 归档。

## 改动总览（按 Phase）

| Phase | 主题 | 关键产出 |
|---|---|---|
| 0 | 在飞部分索引 | `*_inflight_queuedAt_idx`、`*_submitted_lastPolledAt_idx`、`GatewayRequestLog_running_submittedAt_idx`（裸 SQL partial index）；回归守卫单测保证 WHERE 集合 == `GENERATION_INFLIGHT_STATUSES` |
| 1 | 读路径不再重 poll | `isOpportunisticPollFallbackEnabled`（`CANVAS_OPPORTUNISTIC_POLL`）；读路径默认关，写路径（提交后）仍单飞兜底；项目 GET 改 fire-and-forget |
| 2 | 状态投影计数 | 新表 `GatewayStatsCounter`；`lib/gateway/stats-counter.ts`（bump + 短 TTL 自愈读 + reconcile）；接入 `createRequestLog`/`finalizeRequestLog`；状态页实时无过滤查询走投影；`gateway:stats-reconcile` 脚本 |
| 3 | 账户串行写 | `writeLedger` 事务首条 `pg_advisory_xact_lock`（按账户派生键）；同账户排队、异账户互不阻塞，消除 P2034 雪崩 |
| 4 | 前端自适应轮询 | `nextPollIntervalMs` 纯函数 + 自调度 `setTimeout`；按在飞数退避、无在飞暂停、stale 退避 15s |
| 5A | 历史归档 | `GatewayRequestLogArchive` / `CreditLedgerArchive`；`hotcold:archive`（事务内 INSERT+DELETE，幂等，dry-run）；报表按时间路由读 helper |
| 6 | 连接预算 / 读路由 | 所有环境注入 `connection_limit`；`DATABASE_REPLICA_URL` + `prismaRead`，仪表盘聚合走只读副本；worker 进程隔离（Web 不跑重 poll） |
| 5B | 原生月分区（后置） | `prisma/manual/genhotcold-r2-native-partition.sql.template`（DBA 评估后手工，含复合主键说明） |

## 正确性保证

- **投影计数**可能短暂漂移；真相恒为 `GatewayRequestLog`。读路径短 TTL 过期即全量重算回填，并发重算单飞合并；`gateway:stats-reconcile` 定期纠偏并清理陈旧签名缓存行。
- **归档**每批「INSERT…ON CONFLICT DO NOTHING + DELETE」同事务，要么全成要么全回滚，按 id 幂等可重复跑；账本保留期默认 365 天，确保不删可能被幂等重试命中的 `idempotencyKey`；余额真相在 `CreditAccount`，不依赖账本重算。
- **advisory 锁**按 `credit-account:<ownerType>:<ownerId>` SHA256 派生命名空间键，不同账户键不同。

## 部署步骤

1. `pnpm --dir book-mall db:deploy`（应用三个迁移，均 `IF NOT EXISTS`/幂等）。
2. 重启 `dev:all` / 生产进程（让新 Prisma Client + 投影逻辑生效）。
3. 首次回填投影：`pnpm --dir book-mall gateway:stats-reconcile`。
4. （可选）配置 `DATABASE_REPLICA_URL` 启用只读副本读路由。
5. 归档前先 dry-run：`pnpm --dir book-mall hotcold:archive:dry-run`，确认候选量后再 `hotcold:archive`，建议挂 cron。

## 测试

- 单测：`poll-partial-index-where`、`stats-counter`、`dashboard-stats-fallback`、`credit-advisory-lock`、`hotcold-archive-read`（book-mall）；`poll-interval`（canvas-web）。
- 集成压测：`pnpm --dir book-mall test:gen-hotcold-integration`（同账户 8 并发无丢更新 / 异账户互不阻塞 / 投影自愈）。

## 回滚

生产严禁直接回滚迁移。如需停用：清空 `CANVAS_OPPORTUNISTIC_POLL`、不再调用 reconcile/archive 脚本即可回到「全量计算 + 主表」语义；投影/归档表保留不影响主流程。
