# story-web 三期 · 全量实施跟踪

详见 `plan.md` §14（实施进度）与 `todo.md`（步骤明细）。

| 批次 | 状态 |
|------|------|
| B0 数据建模 | ✅ |
| B1 项目 CRUD | ✅ |
| B2 LLM 初始化 | ✅ |
| B3 KIE 出图 / OSS / callback / poll / cleanup | ✅ |
| B4 分镜文本 + 3/5/8 | ✅ |
| B5 单分镜图 / 视频 | ✅ |
| B6 编辑 / 重试 / 删除 / 二次确认 | ✅ |
| B7 文档收尾 | ✅ |

## LLM 提供方修订（2026-05-22）

不再依赖 OpenRouter；改为 KIE.AI 官方文档（`docs/kie/gemini 3 Flash.md`）的托管端点：
`POST {KIE_API_BASE}/gemini-3-flash/v1/chat/completions`，鉴权与图像/视频共用 `KIE_API_KEY`。
入口文件：`book-mall/lib/story/gemini-llm-client.ts`。

## 待运维 / 用户配置

1. `book-mall/.env.local` 配齐：`KIE_API_KEY` / `KIE_API_BASE` / `KIE_CALLBACK_TOKEN` / `STORY_AI_PUBLIC_BASE` / `STORY_AI_POLL_TOKEN`（LLM 与图像/视频共用同一把 KIE key）；
2. `story-web/.env.local` 中的 `KIE_API_KEY` 已无需保留（可注释 / 删除）；
3. 腾讯云托管两条定时任务：
   - 每 30s：`POST {STORY_AI_PUBLIC_BASE}/api/story/kie/poll`（`Authorization: Bearer ${STORY_AI_POLL_TOKEN}`）
   - 每 60s：`POST {STORY_AI_PUBLIC_BASE}/api/story/kie/cleanup`（同上）；
4. 本地开发可用：
   - `pnpm story:poll-once`（book-mall 工作目录）触发一次轮询；
   - `pnpm story:cleanup-once` 触发一次 OSS 清理；
5. 前端 `next/image` 已通过 `NEXT_PUBLIC_OSS_HOSTS` 白名单；自定义 CDN 域请加入。
