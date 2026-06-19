# 腾讯云 SCF：book-mall KIE 定时 poll / cleanup

## Zip 包（本地上传）

| Zip 文件 | 云函数名建议 | 调用接口 | 定时规则 |
|----------|-------------|----------|----------|
| `book-mall-story-kie-poll.zip` | `book-mall-story-kie-poll` | `POST /api/story/kie/poll` | 每 1 分钟 |
| `book-mall-story-kie-cleanup.zip` | `book-mall-story-kie-cleanup` | `POST /api/story/kie/cleanup` | 每 1 分钟 |
| `book-mall-canvas-kie-poll.zip` | `book-mall-canvas-kie-poll` | `POST /api/canvas/kie/poll` | 每 1 分钟（~15 人同时长视频建议 **30 秒**） |
| `book-mall-canvas-kie-cleanup.zip` | `book-mall-canvas-kie-cleanup` | `POST /api/canvas/kie/cleanup` | 每 1 分钟 |

重新打包（仓库根目录执行）：

```bash
cd deploy/tencent/scf
for d in book-mall-story-kie-poll book-mall-story-kie-cleanup book-mall-canvas-kie-poll book-mall-canvas-kie-cleanup; do
  (cd "$d" && zip -r "../${d}.zip" index.js)
done
```

## 云函数控制台（四个函数配置相同）

1. **运行环境**：Node.js 18+
2. **执行方法**：`index.main`
3. **环境变量**（必填）：
   - `STORY_AI_POLL_TOKEN` = 与 book-mall 生产环境 **完全相同**
   - （可选）`BOOK_MALL_HOST` = `book.ai-code8.com`（默认已是）
4. **超时时间**：book-mall poll API 默认 `GENERATION_POLL_MAX_DURATION_SEC=300`；SCF 若上限 60s 仍可用（worker 会在 50s 预算内返回）。**100+ 并发建议**另起 book-mall 侧车跑 `pnpm canvas:poll-loop`（5s），或部署 **4 个分片 SCF**（见下）。
5. **水平分片（50～100+ 路 SUBMITTED）**：复制 `book-mall-canvas-kie-poll` 为 4 个函数，book-mall env 设 `GENERATION_POLL_SHARD_COUNT=4`，各函数额外 env：`GENERATION_POLL_SHARD_INDEX=0`…`3`；Cron 可均为每 30 秒。
6. **上传**：本地上传 → 选对应 zip
7. **触发器**：定时触发器，Cron 示例（7 段，每秒位）：
   - poll：`0 */1 * * * *`（每分钟第 0 秒）
   - cleanup：`30 */1 * * * *`（每分钟第 30 秒，与 poll 错开）

## 验收

云函数「测试」或等定时触发后，日志应出现 `"ok": true, "status": 200`。

手动 curl（替换 token）：

```bash
curl -s -X POST 'https://book.ai-code8.com/api/canvas/kie/poll' \
  -H 'Authorization: Bearer <STORY_AI_POLL_TOKEN>'
```

---

## canvas-web 上线前 book-mall 必配（与云函数无关但缺一不可）

在 **book-mall 生产环境** 确认已配置：

```ini
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=tool-mall
OSS_REGION=oss-cn-guangzhou

KIE_API_KEY=
KIE_CALLBACK_TOKEN=
STORY_AI_PUBLIC_BASE=https://book.ai-code8.com
STORY_AI_POLL_TOKEN=          # 与上面四个云函数相同

CANVAS_WEB_ORIGINS=https://canvas.ai-code8.com
CANVAS_CORS_IN_APP=1
CANVAS_SECRET_KEY=            # openssl rand -base64 32，部署前固定
NEXTAUTH_COOKIE_DOMAIN=.ai-code8.com
```

并确保 book-mall 已部署含 canvas 迁移的版本（`prisma migrate deploy`），且包含：

- `POST /api/canvas/portrait/virtual/import` · `POST /api/canvas/portrait/real/import`
- 迁移 `20260618210000_project_asset_private_portrait`（`ProjectAssetKind.PRIVATE_PORTRAIT`）

LibTV 图片节点「入库」依赖上述 API；若返回 404，说明主站镜像过旧（检查 CloudBase 构建是否成功）。
