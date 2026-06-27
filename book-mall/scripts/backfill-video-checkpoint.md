# 画布视频回填 · 进度检查点

**暂停时间：** 2026-06-27（用户要求先停，后续再跑）

## 总量

- 库内 `SUCCEEDED` + `node-video`：**965** 条

## 已完成（faststart）

| 阶段 | offset 范围 | faststart 成功 | 失败 | 备注 |
|---|---|---|---|---|
| 首轮（无 offset） | 0–49 | ~40 | 1 | 见 `cmqutcmkt0i93…` |
| 分页续跑 | 50–99 | 50 | 0 | |
| 分页续跑 | 100–149 | 50 | 0 | poster +2 |
| 分页续跑 | 150–199 | 50 | 0 | |
| 分页续跑 | 200–249 | 50 | 0 | |
| 分页续跑 | 250–299 | 49 | 1 | 见 `cmqs6jzm9083…`；poster +5 |
| 分页续跑 | 300–349 | 50 | 0 | poster +2 |
| **暂停时** | **350–** | **未完成** | — | 本批刚开或未跑完 |

**约已 faststart：339 条**（40 + 299；不含 offset 350 本批）

## 剩余

- **从 offset 350 继续**：约 **615** 条待扫（350 → 964）
- 预计约 **13** 批（每批 `--limit 50`）
- **poster 全量扫尾**：faststart 分页全部完成后，再跑 `--poster-only` 分页（尚未开始）
- **失败重试**：offset 0 与 250 各 1 条，续跑时同批会自然重试（幂等）

## 失败任务 ID（便于人工查）

1. `cmqutcmkt0i93yw01w5er2p3x`（首轮 offset 0 窗口）
2. `cmqs6jzm9083pql011u9bd3za`（offset 250 窗口）

## 日志

- 首轮：`/tmp/backfill-all-batches.log`
- 分页续跑：`/tmp/backfill-rest-batches.log`

## 恢复执行

```bash
cd book-mall

# 从 offset 350 继续 faststart+poster 分页（每批 50，批间 10s）
LOG=/tmp/backfill-rest-batches.log
BATCH=50
offset=350
while true; do
  echo "========== offset=$offset limit=$BATCH $(date '+%H:%M:%S') ==========" | tee -a "$LOG"
  out=$(pnpm canvas:backfill-video -- --apply --limit $BATCH --offset $offset 2>&1)
  echo "$out" | tee -a "$LOG"
  scan=$(echo "$out" | grep 'scan tasks=' | tail -1 | sed -n 's/.*scan tasks=\([0-9]*\).*/\1/p')
  echo "$out" | grep '\[backfill-video\] done' | tail -1 | tee -a "$LOG"
  [ "${scan:-0}" -eq 0 ] && break
  offset=$((offset + BATCH))
  sleep 10
done

# faststart 分页结束后：poster 扫尾
poff=0
while true; do
  out=$(pnpm canvas:backfill-video -- --apply --poster-only --limit $BATCH --offset $poff 2>&1)
  echo "$out" | tee -a "$LOG"
  scan=$(echo "$out" | grep 'scan tasks=' | tail -1 | sed -n 's/.*scan tasks=\([0-9]*\).*/\1/p')
  [ "${scan:-0}" -eq 0 ] && break
  poff=$((poff + BATCH))
  sleep 5
done
```

单批试跑：`pnpm canvas:backfill-video -- --apply --limit 50 --offset 350`
