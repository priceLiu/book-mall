# story-web 三期 · AI 创作生产线 · 后端逻辑

> 完整需求与决议见 `story-web/docs/ai/plan.md`，实施清单见 `story-web/docs/ai/todo.md`。
> 本文聚焦 **book-mall 后端** 的状态机、回调、轮询、OSS 清理逻辑；前端形态见 plan.md §7。

---

## 1. 范围

`story-web` 通过 `/api/book-mall/*` 代理或同源直接调用以下接口：

| 入口 | 说明 |
|------|------|
| `/api/story/projects` GET/POST | 项目列表 / 新建 |
| `/api/story/projects/:id` GET/PATCH/DELETE | 项目详情 / 编辑 / 软删 |
| `/api/story/projects/:id/initialize` POST | 一键初始化（大纲 + 角色 + 封面 + 头像） |
| `/api/story/projects/:id/storyboard/generate` POST | 一键生成分镜文本（3/5/8） |
| `/api/story/projects/:id/frames/:frameId/{image,video}` POST | 单分镜出图 / 出视频 |
| `/api/story/projects/:id/{cover, characters/:cid/avatar}` POST | 重新生成封面 / 头像 |
| `/api/story/projects/:id/tasks` GET | 任务进度（前端 5s 轮询用） |
| `/api/story/kie/callback/:kind` POST | KIE 回调入口（image / video） |
| `/api/story/kie/poll` POST | 轮询 worker 触发器（cron 30s） |
| `/api/story/kie/cleanup` POST | OSS 清理 worker（cron 60s） |

鉴权：`getServerSession(authOptions)`；CORS 复用 `lib/story/cors.ts` 的 `STORY_WEB_ORIGINS`。

---

## 2. KIE 任务状态机

```
                 createTask 200          callback success / poll success
PENDING ────────────▶ SUBMITTED ─────────────────▶ SUCCEEDED
   │                       │
   │ createTask 5xx        │ callback fail / poll fail / timeout
   ▼                       ▼
 retry≤3                 FAILED
```

- `PENDING`：任务已落库未提交 KIE，`submitGenerationTask` 在 ≤3 次内重试。
- `SUBMITTED`：已下发 KIE，等待回调或轮询。
- `SUCCEEDED`：已落 OSS 且写回目标实体（`StoryProject.coverImageUrl` / `StoryCharacter.avatarUrl` / `StoryStoryboardFrame.imageUrl|videoUrl`）。
- `FAILED`：写 `failCode + failMessage`；前端「重试」按钮触发新建一笔任务（旧 task 不再轮询）。
  - `failCode = "timeout"`：累计超过 `STORY_AI_TASK_TIMEOUT_MIN`（默认 20 分钟）仍未 success。
  - `failCode = "oss_upload_failed"`：本地下载 + 上传 OSS 重试 ≤2 次仍失败；`resultPayload.ephemeralUrl` 保留作为人工补救入口（24h 内有效）。

---

## 3. 回调入口

- `POST /api/story/kie/callback/:kind`，`:kind ∈ image | video`。
- Query：`token`（必须等于 `KIE_CALLBACK_TOKEN`）、`taskRef`（即 `StoryGenerationTask.id`）。
- Body：与 `recordInfo` 响应同结构。
- 处理：
  1. 校验 token + taskRef → 不匹配返回 401（不暴露细节）；
  2. 找到 task；若已 `SUCCEEDED` 直接返回 200（幂等）；
  3. `body.data.state === "success"`：从 `resultJson.resultUrls[0]` 取 ephemeralUrl → 下载 + 上传 OSS（本地重试 ≤2 次）→ 写回目标实体 + task `SUCCEEDED`；
  4. `body.data.state === "fail"`：写 `failCode/failMessage` + task `FAILED`；
  5. 始终返回 200，避免 KIE 重试风暴。
- **日志脱敏**：写日志/error tracker 前用 `maskTokenInUrl()` 把 `?token=xxx` 替换为 `?token=***`。

---

## 4. 轮询 worker

- `POST /api/story/kie/poll`，`Authorization: Bearer ${STORY_AI_POLL_TOKEN}`。
- 选取条件：`status = SUBMITTED AND (lastPolledAt is null OR lastPolledAt < now() - interval)`，每次 ≤ 20 条。
- 退避：`interval = min(2s × 2^pollCount, 60s)`，`pollCount` 写表。
- 累计提交超过 `STORY_AI_TASK_TIMEOUT_MIN` 仍未 success → 标记 `failCode: "timeout"`。
- 共用 `applyKieTaskResult`（与回调入口同一实现）。
- **本地开发**（决议 §13.6）：`STORY_AI_PUBLIC_BASE` 为空时，`createKieTask` 不下发 callBackUrl；纯靠 poll worker。前端 `/tasks` 5s 轮询会顺带触发后端按需主动 `recordInfo`。

---

## 5. OSS 路径与中转

- 路径规则：
  - 封面：`story/cover/{projectId}/{uuid}.png`
  - 头像：`story/character/{projectId}/{characterId}/{uuid}.png`
  - 分镜图：`story/frame-image/{projectId}/{frameId}/{uuid}.png`
  - 分镜视频：`story/frame-video/{projectId}/{frameId}/{uuid}.mp4`
- ACL：`public-read`；公网 URL 通过 `OSS_PUBLIC_URL_BASE` 优先返回；删除走 `deleteManagedOssObjectByUrl`。
- 中转工具：`book-mall/lib/story/story-oss.ts`（B3 落地，参考 `tool-web/lib/ai-fit-oss-upload.ts`）。
- 上传失败本地重试 ≤2 次；仍失败 → task `FAILED`，`resultPayload.ephemeralUrl` 保留。

---

## 6. OSS 异步清理 worker

- `POST /api/story/kie/cleanup`，复用 `STORY_AI_POLL_TOKEN`。
- 选取：`StoryOssCleanupQueue` 中 `doneAt is null AND notBefore <= now() AND attempts < 3`，每次 ≤ 50 条；并发 ≤ 5。
- 处理：调 `deleteManagedOssObjectByUrl`；成功写 `doneAt`；失败 `attempts += 1` + 写 `lastError`；attempts ≥ 3 后停手。
- 入队场景：
  - 项目软删：项目下所有媒体 ossUrl 入队，`source = "project_delete:{projectId}"`，`notBefore = now()`；
  - 单角色 / 单分镜删除：对应资源 ossUrl 入队；
  - 媒体重新生成：旧 ossUrl 入队，`notBefore = now() + 5min`，给 CDN 回源 + 前端缓存留窗口。

---

## 7. Prompt 拼装规则

**关键设计**：`StoryCharacter.imagePrompt` 与 `StoryStoryboardFrame.imagePrompt` **不存风格段**。
风格 prompt 在调用 KIE 时由 `getStoryStylePrompt(project.styleId)` 实时 prepend `[STYLE] ...`。

**好处**：
- 用户切换 `project.styleId` 立即生效（无需重写 prompt）；
- 用户编辑 imagePrompt 时无需小心保留风格段；
- `StoryGenerationTask.inputPayload` 仍记录调用时的完整 prompt（含风格），便于审计。

**白底要求**：仍写在 `StoryCharacter.imagePrompt` 中（不是画幅约束，是为后续作为 frame `image_input` 一致性更稳）。

---

## 8. 限流与并发

| 维度 | 软上限 | 控制方式 |
|------|--------|----------|
| 单用户活跃任务（PENDING + SUBMITTED） | `STORY_AI_USER_INFLIGHT_MAX`（默认 50） | 提交前 `count` 校验，超额 429 `code: TOO_MANY_INFLIGHT` |
| KIE 全局并发 | `STORY_AI_KIE_MAX_CONCURRENCY`（默认 10） | 进程内 semaphore（多副本时按 ceil 拆分） |
| KIE LLM 全局并发 | `STORY_AI_LLM_MAX_CONCURRENCY`（默认 5；旧名 `STORY_AI_OPENROUTER_MAX_CONCURRENCY` 仍兼容） | 同上 |
| 轮询 worker 单次批量 | 20 | hard-coded |
| 清理 worker 单次批量 | 50 | hard-coded |

---

## 9. 错误码（前端约定）

| code | 状态码 | 含义 |
|------|--------|------|
| `UNAUTHORIZED` | 401 | 未登录 |
| `NOT_FOUND` | 404 | 项目不存在或不属于当前用户（不暴露存在） |
| `INVALID_INPUT` | 400 | 入参校验失败（如 `count` 不在 3/5/8） |
| `EMPTY_PROMPT` | 400 | imagePrompt 被改为空字符串 |
| `MISSING_DEPENDENCY` | 409 | 出图前角色头像未就绪 / 出视频前分镜图未就绪 |
| `TASK_ALREADY_INFLIGHT` | 409 | 同一资源已有 SUBMITTED 任务 |
| `TOO_MANY_INFLIGHT` | 429 | 单用户活跃任务超限 |
| `LLM_QUOTA_EXCEEDED` | 502 | KIE LLM 余额不足 |
| `LLM_MODEL_NOT_FOUND` | 502 | gemini-3-flash 端点不可用；检查 `KIE_API_BASE` 或 `STORY_AI_GEMINI_ENDPOINT` |
| `LLM_INVALID_JSON` | 502 | LLM 输出无法解析为 JSON（已重试 1 次） |
| `LLM_HTTP_ERROR` | 502 | 上游非 2xx 且不属于上述具体错误 |
| `KIE_CREATE_FAILED` | 502 | KIE createTask 调用失败（服务端会重试 ≤3 次） |
| `KIE_NOT_CONFIGURED` | 503 | `KIE_API_KEY` 缺失 |

---

## 10. 部署 / 上线检查

参见 `story-web/docs/ai/plan.md` §12。要点：

- `book-mall/.env.local` 5 个新 env 全部非空（`KIE_API_KEY` / `KIE_API_BASE` / `KIE_CALLBACK_TOKEN` / `STORY_AI_POLL_TOKEN` / `STORY_AI_PUBLIC_BASE`），LLM 与图像/视频共用同一把 `KIE_API_KEY`；
- `OSS_BUCKET / OSS_REGION / OSS_PUBLIC_URL_BASE` 已就绪；
- `story-web` 的 `NEXT_PUBLIC_OSS_HOSTS` 包含 OSS 自定义 CDN（`*.aliyuncs.com` 已默认通配）；
- 腾讯云托管定时任务：30s `/api/story/kie/poll`、60s `/api/story/kie/cleanup`；
- `STORY_AI_PUBLIC_BASE` 在生产指向 book-mall 公网域。

---

## 11. 实现状态（2026-05-22 全量实施完成）

| 模块 | 文件 | 状态 |
|------|------|------|
| Prisma schema 迁移 | `prisma/migrations/20260705120000_story_web_phase3/migration.sql` | ✅ deploy |
| 共享常量 / 风格 prompt | `lib/story/{story-ai-constants.ts, comic-styles.ts, styles.json}` | ✅ |
| 同步脚本 | `scripts/sync-story-styles.ts` + `pnpm story:sync-styles[:check]` | ✅ |
| Project CRUD service | `lib/story/story-project-service.ts` | ✅ |
| API helpers（鉴权 / CORS / JSON） | `lib/story/api-helpers.ts` | ✅ |
| KIE Gemini 3 Flash LLM client | `lib/story/gemini-llm-client.ts`（OpenAI Chat Completions 兼容） | ✅ |
| Story initializer（大纲 + 角色） | `lib/story/story-initializer.ts` | ✅ |
| Storyboard 文本生成 | `lib/story/story-storyboard-service.ts` | ✅ |
| KIE client | `lib/story/kie-client.ts` | ✅ |
| OSS 中转 | `lib/story/story-oss.ts` | ✅ |
| Task service（提交 / 应用 / poll / cleanup） | `lib/story/story-task-service.ts` | ✅ |
| API：项目 / 初始化 / 分镜 | `app/api/story/projects/...` | ✅ |
| API：KIE callback / poll / cleanup | `app/api/story/kie/...` | ✅ |
| API：character / frame PATCH+DELETE / tasks | `app/api/story/projects/[id]/{characters,frames,tasks}/...` | ✅ |
| Cron 脚本 | `scripts/story-ai-{poll,cleanup}.ts` + `pnpm story:{poll,cleanup}-once` | ✅ |
| 前端 destructive-confirm-modal | `story-web/components/common/destructive-confirm-modal.tsx` | ✅ |
| 前端联通 | `story-web/lib/projects/api.ts` + `components/projects/*` + `components/project-workspace/*` | ✅ |

### 故意延后 / 不在本期

- `StoryGenerationTask` 列表前端 UI 已有 API（`/tasks`）但当前 UI 仅在 header 显示进行中数量；详细列表面板可后续再加。
- 多副本部署下 `STORY_AI_KIE_MAX_CONCURRENCY / STORY_AI_LLM_MAX_CONCURRENCY` 仅以进程内 semaphore 形式存在（决议保留为软上限；Redis 跨进程版本未做）。
- 角色 / 分镜的 reorder（拖拽排序）未做；当前 `sortOrder` 由 LLM 顺序决定。

