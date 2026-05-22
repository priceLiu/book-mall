# story-web 三期 · AI 创作生产线 — 实施清单

> 基于 [`./plan.md`](./plan.md) 第 11 节的 B0–B7 分批拆解，每条均为可独立提交的最小任务。
> 勾选规则：`[ ]` 待做、`[x]` 完成、`[~]` 进行中、`[!]` 阻塞（需在备注里写明阻塞原因）。
> 每批开工前，务必先逐条核对 plan.md 对应章节再动手，遇到 schema / 提示词分歧以 plan.md 为准。
> 每完成一条带 ⚠️ 的"破坏性 / 数据库 / 配置"动作，都需要在 PR / commit message 中说明影响范围。

---

## B-1 · 开工前同步（已完成 ✅）

- [x] plan.md §13 已收敛为 6 条决议（见 plan.md §13 与本文末「决议记录」）
- [ ] OpenRouter 控制台核验 `google/gemini-3-flash-preview` 可用性 —— 决议 §13.5：不强制阻塞，先按此值落地，404 时运维改 `OPENROUTER_DEFAULT_MODEL`
- [ ] KIE 控制台确认 `nano-banana-pro` / `wan/2-7-image-pro` 配额与单价；评估首次初始化预计消耗（封面 1 + 角色 3–8 + 后续分镜图/视频）
- [ ] 阿里云 OSS 控制台确认 `OSS_BUCKET` 子目录 `story/` 可写、`OSS_PUBLIC_URL_BASE` 是否已配自定义 CDN
- [ ] 把 `story-web/.env.local` 里的 `KIE_API_KEY` 值复制到 `book-mall/.env.local` 的对应键（B7 再正式注释 story-web 那份）

---

## B0 · 数据建模与迁移（book-mall）

> 目标：新增 5 张表 + 4 个枚举；不动现有表；本地 + Neon 都能 `pnpm db:deploy` 通过。
> 表清单：`StoryProject / StoryCharacter / StoryStoryboardFrame / StoryGenerationTask / StoryOssCleanupQueue`。

### B0.1 schema 与迁移

- [ ] 编辑 `book-mall/prisma/schema.prisma`：在文件末尾追加 plan.md §2 中的 4 个枚举 + 5 个 model
- [ ] 在 `User` model 上追加反向关系字段：`storyProjects StoryProject[]`
- [ ] ⚠️ 生成迁移：`pnpm prisma migrate dev --name story_web_phase3 --create-only`（先 `--create-only` 检查 SQL）
- [ ] 检查生成的 SQL：5 张表的索引齐全、外键 `onDelete: Cascade` 与 schema 一致；`text[]` 列名为 `characterIds`
- [ ] ⚠️ 应用到本地：`pnpm db:migrate`，`pnpm prisma generate`
- [ ] `pnpm prisma migrate status` 输出干净
- [ ] `pnpm tsc --noEmit` 通过（确保 schema 变更不破坏既有 TS）

### B0.2 文档归档与配置

- [ ] 在 `book-mall/doc/database/schema-changelog.md` 追加一条「story-web 三期：AI 流水线表结构」，列出 5 张表与索引
- [ ] 新增 `book-mall/doc/logic/story-ai-pipeline.md`：引用 plan.md §6 状态机、回调、OSS 清理流程
- [ ] ⚠️ `book-mall/.env.example` 增加 7 个新 env 占位（plan §3 完整列表）
- [ ] ⚠️ `story-web/next.config.mjs` 的 `images.remotePatterns` 加上 OSS 主机名（虚拟域名 + `OSS_PUBLIC_URL_BASE`）

### B0.3 共享常量

- [ ] 新建 `book-mall/lib/story/story-ai-constants.ts`：导出
  - `STORY_AI_KIE_MODELS = { IMAGE: "nano-banana-pro", VIDEO: "wan/2-7-image-pro" } as const`
  - `STORY_AI_FRAME_COUNT_OPTIONS = [3, 5, 8] as const`，`STORY_AI_DEFAULT_FRAME_COUNT = 5`
  - `STORY_AI_TASK_TIMEOUT_MIN = 20`
  - `STORY_AI_USER_INFLIGHT_MAX`（从 env 读，默认 50）
  - `buildStoryOssKey(kind, { projectId, refId?, ext })`

- [ ] **B0 验收**：本地连 Neon dev 库 `pnpm db:migrate status` 干净；`prisma studio` 可见 5 张新表为空表；`pnpm dev` 启动无 schema warning

---

## B1 · 项目 CRUD（前后端最小闭环）

> 目标：用户能登录后看到自己的项目列表、新建项目（仅文本字段）、刷新后保留。

### B1.1 服务层（book-mall）

- [ ] 新建 `book-mall/lib/story/story-project-service.ts`：导出
  - `listProjectsForUser(userId)` —— 过滤 `deletedAt is null`，按 `updatedAt desc`
  - `createProjectForUser(userId, input)` —— 入参校验（name / description 非空、styleId 1–N 校验、aspectRatio 二选一）
  - `getProjectForUser(userId, id)` —— 含 `characters`/`frames`/`pendingTasks`
  - `updateProjectForUser(userId, id, patch)` —— 仅 DRAFT 阶段允许改 `styleId / aspectRatio`
  - `softDeleteProjectForUser(userId, id)` —— 写 `deletedAt`，返回需清理的 OSS URL 列表（B6 才用）
- [ ] 添加单元/集成测试（如已有 vitest 套件）覆盖鉴权与跨用户隔离

### B1.2 API 路由（book-mall）

- [ ] `book-mall/app/api/story/projects/route.ts` —— `GET` 列表 + `POST` 新建
- [ ] `book-mall/app/api/story/projects/[id]/route.ts` —— `GET / PATCH / DELETE`
- [ ] 每个路由：复用 `storyCorsHeaders` + `Cache-Control: private, no-store` + `getServerSession` 鉴权
- [ ] OPTIONS 预检统一 204

### B1.3 story-web 改造

- [ ] 新建 `story-web/lib/projects/api.ts`：封装 `listProjects / createProject / getProject / patchProject / deleteProject`，统一错误对象 `BookMallApiError`
- [ ] 修改 `story-web/lib/projects/types.ts`：按 plan.md §7.5 扩展字段（保留 UI 现用字段做降级别名，避免一次性大改）
- [ ] 改写 `story-web/lib/projects/store.ts`：移除 localStorage，转发到 `api.ts`；`generateMockStoryboard` 等 mock 函数标记 `@deprecated` 待 B4/B5 删除
- [ ] 修改 `components/projects/projects-page-client.tsx`：
  - 加 loading 状态 → 列表骨架（6 张卡）
  - 加错误态 toast / 重试按钮
- [ ] 修改 `components/projects/create-project-form.tsx`：`createProject` 改为 await、错误展示
- [ ] 添加项目卡片右上 `…` 菜单（首批仅占位，B6 接删除）

### B1.4 联调

- [ ] 本地 `book-mall` 跑在 3000，`story-web` 跑在 3003，登录态可同源 cookie 传递
- [ ] 列表 / 新建 / 详情接口在 DevTools Network 走通
- [ ] 跨用户检查：用户 A 不能 GET 用户 B 的 projectId（返回 404）

- [ ] **B1 验收**：登录后能新建一个项目、刷新后仍在；状态字段正确（`DRAFT`，其它资源字段为空）

---

## B2 · LLM 流水线（大纲 + 角色，无 KIE）

> 目标：点击「一键初始化」后，大纲与角色（含 imagePrompt）落库；前端能渲染文本，头像/封面仍为占位。

### B2.1 OpenRouter 客户端

- [ ] 新建 `book-mall/lib/story/openrouter-client.ts`
  - 函数 `chatJson<T>({ system, user, schema, model? }): Promise<T>`
  - 内部使用 `fetch('https://openrouter.ai/api/v1/chat/completions')`
  - 启用 `response_format: { type: "json_object" }`
  - 失败重试 1 次（temperature 0 → 0.3）
  - 错误码 `OPENROUTER_QUOTA_EXCEEDED / OPENROUTER_INVALID_JSON / OPENROUTER_HTTP_<code>`
- [ ] 引入 `zod`（如尚未引入）做 JSON 校验；schema 文件 `book-mall/lib/story/story-llm-schemas.ts`
  - `OutlineSchema = z.object({ outline: z.string().min(200) })`
  - `CharactersSchema = z.object({ characters: z.array(z.object({ name, role, description, appearance })).min(1).max(8) })`
  - `FramesSchema`（B4 用，可一并定义）

### B2.2 提示词

- [ ] 新建 `book-mall/lib/story/story-prompts.ts`：导出
  - `buildOutlineSystemPrompt()` / `buildOutlineUserPrompt({ name, description })`
  - `buildCharactersSystemPrompt()` / `buildCharactersUserPrompt({ outline })`
  - `buildFramesSystemPrompt()` / `buildFramesUserPrompt({ outline, characters, count })`
  - `buildCharacterImagePrompt({ stylePrompt, appearance })` —— 按 plan.md §5.2.2 拼装
  - `buildFrameImagePrompt({ stylePrompt, characters, sceneText })`
  - `buildCoverImagePrompt({ stylePrompt, name, outlineSummary })`

### B2.3 风格读取（副本 + 同步脚本）

- [ ] 拷贝一份到 `book-mall/lib/story/styles.json`（与 `story-web/src/shared/styles/index.json` 同结构）
- [ ] 新建 `book-mall/scripts/sync-story-styles.ts`：从 `../story-web/src/shared/styles/index.json` 读取 → 写入 `book-mall/lib/story/styles.json`；输出 sha256 校验结果
- [ ] `book-mall/package.json` 添加 `"story:sync-styles": "tsx scripts/sync-story-styles.ts"`，CI 加一步检查（drift 时报错）
- [ ] 新建 `book-mall/lib/story/comic-styles.ts`：导出 `getStyleById(id)` / `STORY_COMIC_STYLES`

### B2.4 初始化接口（仅文本部分）

- [ ] 新建 `book-mall/lib/story/story-initializer.ts`：导出 `initializeStoryProject(userId, projectId)`
  - 步骤：
    1. 校验项目所属 + 用户 inflight 任务数（≤ `STORY_AI_USER_INFLIGHT_MAX`）；
    2. 若 `storyOutline === ""`：调 `chatJson` 生成 outline → 写库；
    3. 若 `characters` 为空：调 `chatJson` 生成 characters → **落库的 `imagePrompt` 仅含外观/构图/白底（不含 [STYLE]）** → `createMany`；
    4. `project.status = INITIALIZING`
  - 返回 `{ project, characters }`（不含 KIE，B3 才提交）
- [ ] 新增路由 `book-mall/app/api/story/projects/[id]/initialize/route.ts` POST
- [ ] story-web `lib/projects/api.ts` 增加 `initializeProject(id)`

### B2.5 前端改造（故事设定 tab）

- [ ] 修改 `components/project-workspace/story-setup-tab.tsx`：
  - 当 `storyOutline === ""` 时渲染全局空态卡 + 「一键初始化故事」CTA
  - 点击调 `initializeProject(id)`，按阶段显示 loading 文案：`大纲生成中…` → `角色抽离中…`
  - 失败 toast + 「重试」按钮
- [ ] 修改 `components/project-workspace/project-workspace-client.tsx`：完成后刷新 `getProject(id)`，重新渲染封面/大纲/角色卡（封面/角色头像走骨架，B3 才能填充）

- [ ] **B2 验收**：新建项目 → 一键初始化 → 大纲（>= 600 字）落库；3–8 个角色落库；前端能看到大纲与角色卡（头像还是骨架）

---

## B3 · KIE 出图（封面 + 角色头像）

> 目标：初始化后 1–2 分钟内，封面图与所有角色头像自动落 OSS 并显示。

### B3.1 KIE 客户端

- [ ] 新建 `book-mall/lib/story/kie-client.ts`：
  - `createKieTask({ model, callBackUrl?, input }): Promise<{ taskId }>` —— `callBackUrl` 可选，`STORY_AI_PUBLIC_BASE` 为空时不下发（决议 §13.6）
  - `getKieTask(taskId): Promise<RecordInfo>`
  - 统一错误处理与日志（token 脱敏，plan §6.6）
- [ ] env 加载 `KIE_API_KEY / KIE_API_BASE / KIE_CALLBACK_TOKEN / STORY_AI_PUBLIC_BASE`，启动时校验：
  - `KIE_API_KEY` 缺失 → 启动 warn（不阻塞，但提交任务时返回 503）
  - `STORY_AI_PUBLIC_BASE` 为空 → 启动 info（"KIE 回调未启用，纯轮询模式"）

### B3.2 任务表服务

- [ ] 新建 `book-mall/lib/story/story-task-service.ts`：
  - `createGenerationTask({ projectId, kind, characterId?, frameId?, model, input })`
  - `submitGenerationTask(taskId)` —— 调 KIE createTask + 写入 kieTaskId / status / submittedAt；失败 ≤3 次重试
  - `applyKieTaskResult(task, body)` —— success: 下载临时 URL → 上传 OSS → 写回目标实体；fail: markFailed
  - `markFailed(taskId, code, msg, opts?)`
  - `pickPendingTasksForPoll(limit)` —— 选取 SUBMITTED + 退避命中 的任务

### B3.3 OSS 中转

- [ ] 新建 `book-mall/lib/story/story-oss.ts`：参照 `tool-web/lib/ai-fit-oss-upload.ts`
  - `persistKieImageToOss({ url, projectId, kind, refId }): Promise<string>` （key 走 plan.md §6.4 规则）
  - `persistKieVideoToOss({ url, projectId, frameId }): Promise<string>`
  - 限制：图 ≤ 15MB，视频 ≤ 160MB

### B3.4 初始化接口扩展（封面 + 角色头像）

- [ ] 在 `initializeStoryProject` 末尾追加：
  - 为封面创建 task → `submitGenerationTask`（`aspect_ratio = project.aspectRatio`）
  - 为每个角色创建 task → `submitGenerationTask`（`aspect_ratio = project.aspectRatio`，决议 §13.1 不强制 1:1；imagePrompt 实时拼接 [STYLE]）
- [ ] 在拼装 KIE input 时调 `buildKieImagePrompt(project, character)` 实时合并风格段
- [ ] 返回值附带 `tasks[]`

### B3.5 回调入口

- [ ] 新建 `book-mall/app/api/story/kie/callback/[kind]/route.ts`：
  - 校验 `?token=KIE_CALLBACK_TOKEN`、`?taskRef`
  - body 中 `data.state` 分支处理
  - 始终 200 返回（避免 KIE 重试风暴）
  - 幂等：task 已 SUCCEEDED 直接 200

### B3.6 轮询入口 + 清理 worker

- [ ] 新建 `book-mall/app/api/story/kie/poll/route.ts`：
  - `Authorization: Bearer $STORY_AI_POLL_TOKEN` 校验
  - 调 `pickPendingTasksForPoll(20)` → 并发 `getKieTask` → `applyKieTaskResult`
  - 退避：`interval = min(2s * 2^pollCount, 60s)`；累计 >20min 标记 `failCode: "timeout"`
- [ ] 新建 `book-mall/app/api/story/kie/cleanup/route.ts`：
  - 同 token；扫 `StoryOssCleanupQueue` → `deleteManagedOssObjectByUrl`
- [ ] 新建脚本 `book-mall/scripts/story-ai-poll.ts`：本地跑一次（手动触发轮询）
- [ ] 在 `book-mall/package.json` 添加：
  - `"story:poll-once": "tsx scripts/story-ai-poll.ts"`
  - `"story:cleanup-once": "tsx scripts/story-ai-cleanup.ts"`

### B3.7 前端改造

- [ ] story-setup-tab：
  - 封面区域：`coverImageUrl === ""` 显示骨架 + 「生成中」标签；右上 ⟳ 按钮（B6 接重试）
  - 角色卡：`avatarUrl === ""` 显示骨架；状态 `FAILED` 显示「重试」按钮
- [ ] 项目工作台进入时若 `pendingTasks.length > 0`，启用 5s `getProjectTasks(id)` 轮询；任务全部终态后停止
- [ ] story-web 增加 `lib/projects/api.ts` 中 `getProjectTasks(id)` 方法

### B3.8 联调与验证

- [ ] 本地：手动新建项目 → 一键初始化 → 5–10 分钟内 cover + 所有角色头像落 OSS
- [ ] 验证 OSS 路径正确：`story/cover/<projectId>/...png` 与 `story/character/<projectId>/<characterId>/...png`
- [ ] KIE 控制台核对调用次数与扣费

- [ ] **B3 验收**：初始化全流程跑通；前端骨架能在生成完成后自动替换为成品图

---

## B4 · 分镜文本生成

> 目标：分镜空态时「一键出分镜」生成 5 个分镜（含 imagePrompt / videoPrompt 文本）。

### B4.1 服务层

- [ ] 新增 `book-mall/lib/story/story-storyboard-service.ts`：
  - `generateStoryboardForProject(userId, projectId, { count = 5, force = false })`
  - 校验：项目存在、`storyOutline` 非空、`force=false` 且已有 frames → 抛 409
  - LLM 调用 + JSON 校验（`FramesSchema`）
  - characterNames → characterIds 映射（找不到的丢弃 + warning log）
  - 后端拼装 imagePrompt（带 style.prompt + 角色描述）
  - 同事务：`force=true` 先 `deleteMany frames`，再 `createMany`
  - 返回 `{ frames }`

### B4.2 API

- [ ] `book-mall/app/api/story/projects/[id]/storyboard/generate/route.ts` POST

### B4.3 前端

- [ ] story-web `lib/projects/api.ts` 增加 `generateStoryboard(id, { count?: 3|5|8 })`
- [ ] 修改 `components/project-workspace/storyboard-tab.tsx`：
  - 空态：在「一键出分镜」按钮旁加数量选择器（3 / 5 / 8 三档，默认 5），决议 §13.2
  - 调真实 API；移除现有 mock `generateProjectStoryboard`
  - 加载态 / 错误 toast
  - 列表渲染保留现 UI；图/视频区域走占位（B5 接生成）

- [ ] **B4 验收**：从「分镜设定」空态点击 → N 个分镜文本落库（N ∈ {3,5,8}）；前端正确渲染（图/视频是占位）

---

## B5 · 分镜图与分镜视频

> 目标：用户逐个分镜出图、出视频，全部 OSS 持久化。

### B5.1 服务层

- [ ] 在 `story-task-service.ts` 中增加：
  - `submitFrameImageTask(userId, projectId, frameId)`
    - 校验 frame.characterIds 非空且每角色 avatarUrl 非空，否则 409
    - 取角色头像 URL 列表（最多 8 个）
    - 创建 task → submit
  - `submitFrameVideoTask(userId, projectId, frameId)`
    - 校验 `frame.imageUrl` 非空
    - 创建 task → submit

### B5.2 API

- [ ] `book-mall/app/api/story/projects/[id]/frames/[frameId]/image/route.ts` POST
- [ ] `book-mall/app/api/story/projects/[id]/frames/[frameId]/video/route.ts` POST
- [ ] `book-mall/app/api/story/projects/[id]/frames/[frameId]/route.ts` PATCH（更新 sceneText / sceneDescription / characterIds / imagePrompt / videoPrompt）

### B5.3 前端

- [ ] storyboard-tab 卡片改造：
  - 分镜图：`imageUrl === ""` 显示「生成分镜图」按钮 + 占位；点击调 `generateFrameImage`；状态 `SUBMITTED` 显示 loader 与「使用 nano-banana-pro 生成中…」hint
  - 分镜视频：`imageUrl === ""` 时按钮禁用并 tooltip「请先生成分镜图」；`imageUrl` 就绪后可点击 `generateFrameVideo`
  - `imagePrompt` / `videoPrompt` 编辑保留 PromptEditModal，保存调 `PATCH /frames/:id`
  - 角色绑定编辑（抽屉里多选 project.characters，保存后刷新）
- [ ] 进行中任务接入项目级 5s 轮询（与 B3.7 共用 `pendingTasks`）

### B5.4 联调

- [ ] 全链路：新项目 → 初始化 → 分镜文本 → 单帧图 → 单帧视频；OSS 路径全部正确
- [ ] 多帧并发 4 张图：稳定不串图（OSS key 唯一）

- [ ] **B5 验收**：用户能在分镜页逐张出图 / 出视频，刷新后图/视频 URL 持久；KIE 余额扣费匹配预期

---

## B6 · 编辑、重试、删除（含二次确认 + OSS 清理）

### B6.1 重试入口

- [ ] `POST /api/story/projects/[id]/cover` 重新生成封面（旧 task 标记取消，旧 OSS 文件加入清理队列）
- [ ] `POST /api/story/projects/[id]/characters/[characterId]/avatar` 重新生成头像
- [ ] 分镜图 / 视频重试沿用 B5 接口（创建新 task）
- [ ] 服务层封装 `replaceMediaTask`：旧 ossUrl → 加入 `pendingOssDeletions` 队列；新 task 完成后回写

### B6.2 编辑接口

- [ ] `PATCH /api/story/projects/[id]/characters/[characterId]` —— name / role / description / imagePrompt
- [ ] `PATCH /api/story/projects/[id]/frames/[frameId]` —— 已在 B5 完成
- [ ] `PATCH /api/story/projects/[id]` —— 项目元信息

### B6.3 删除（项目 / 角色 / 分镜）

> `StoryOssCleanupQueue` 表已在 B0 一并建好，B6 直接用。

- [ ] 项目软删除：B1 的 `DELETE` 接口扩展为：写 `deletedAt` + 把项目下所有媒体 ossUrl 入清理队列（事务里完成）
- [ ] 角色硬删：`DELETE /api/story/projects/[id]/characters/[characterId]`
  - 事务：删 character → `array_remove` 所有 frame 中的该 characterId → 头像 ossUrl 入清理队列
- [ ] 分镜硬删：`DELETE /api/story/projects/[id]/frames/[frameId]`
  - 事务：删 frame → 该 frame 的 imageUrl/videoUrl 入清理队列
- [ ] cron 入口已在 B3.6 建好（`/api/story/kie/cleanup`）；B6 校验链路

### B6.4 前端二次确认（强规则）

- [ ] 新增 `story-web/components/common/destructive-confirm-modal.tsx`：通用两次确认 modal（红色破坏色 + 严格按 plan §10 文案）
- [ ] 项目删除入口（`/projects` 项目卡 `…` 菜单 + `/project/:id` 工作台头部）：
  - 第一次："将从我的创作室删除项目《{name}》"
  - 第二次："不可恢复，并会从云端存储（OSS）清理所有封面、角色、分镜图与分镜视频。确认继续？"
- [ ] 重新生成封面 / 角色头像 / 分镜图 / 分镜视频 同样两次确认（第二次提到 OSS）
- [ ] 单角色 / 单分镜删除同上
- [ ] 「重新出分镜」（`force=true`）也必须二次确认（plan §4.1.4）
- [ ] grep 校验：`window.confirm(` 不应出现在 story-web 调用破坏性 API 的代码路径里

### B6.5 测试

- [ ] 删除项目后 1 分钟内：所有 OSS 对象在控制台不可见（用 `tool-web` 已有 `deleteManagedOssObjectByUrl` 校验）
- [ ] 重新生成后旧文件被清理
- [ ] 跨用户删除返回 404，不暴露资源存在性

- [ ] **B6 验收**：每个破坏性入口 UI 都需要点 2 次；OSS 资源在删除/替换后被清理

---

## B7 · 文档、运维与上线

### B7.1 文档

- [ ] 更新 `book-mall/doc/database/schema-changelog.md`：新增 4 张主表 + cleanup queue 的最终条目
- [ ] 完善 `book-mall/doc/logic/story-ai-pipeline.md`：状态机、回调、轮询、OSS 路径、错误码全清单
- [ ] 更新 `story-web/docs/ai/plan.md` 的 §13「待确认事项」为「已决议」（每条带结论）
- [ ] 在 `story-web/README.md` 添加「三期能力」段落，引用 plan.md / todo.md

### B7.2 环境与配置

- [ ] ⚠️ `book-mall/.env.example` 追加：`OPENROUTER_API_KEY / OPENROUTER_DEFAULT_MODEL / KIE_API_KEY / KIE_API_BASE / KIE_CALLBACK_TOKEN / STORY_AI_PUBLIC_BASE / STORY_AI_POLL_TOKEN`
- [ ] ⚠️ `deploy/tencent/book-mall.env.example` 同步增加上述键（生产值由运维填）
- [ ] ⚠️ `book-mall/.env.local`：写入实际值（KIE key 从 `story-web/.env.local` 迁移）
- [ ] ⚠️ `story-web/.env.local`：将 `KIE_API_KEY` 注释掉（标注「已迁移到 book-mall」）；本服务不再消费

### B7.3 定时任务

- [ ] 腾讯云托管：注册 30s cron → `POST /api/story/kie/poll` 带 `Authorization: Bearer $STORY_AI_POLL_TOKEN`
- [ ] OSS 清理：1 分钟 cron → `POST /api/story/kie/cleanup`（保护 token 复用 `STORY_AI_POLL_TOKEN`）

### B7.4 监控

- [ ] 关键日志埋点：`createKieTask` 失败、回调签名失败、任务超时、OSS upload 失败、OpenRouter quota 错误
- [ ] 仪表盘（最简）：`StoryGenerationTask` 按 status 计数；`status=FAILED` 数量异常报警

### B7.5 上线检查

- [ ] plan.md §12 上线检查表逐条勾选
- [ ] 灰度：上线后第一日仅对 `ADMIN` 用户开放（前端 `isAdmin` 隐藏；接口仍校验）
- [ ] 第二日全量

- [ ] **B7 验收**：生产可访问 `https://story.ai-code8.com/projects` 完成全流程；KIE 控制台月账单与表内 task 数量对得上

---

## 决议记录（2026-05-22 已同步）

- [x] §13.1 画幅 / 风格映射 —— 不强制 1:1，封面/头像/分镜图/视频都按 `project.aspectRatio`；头像保留白底要求
- [x] §13.2 分镜数量 —— UI 暴露 3 / 5 / 8 三档下拉，默认 5；后端仅接受这三个枚举
- [x] §13.3 分镜视频 aspect_ratio —— 按项目画幅传入
- [x] §13.4 删除清理 OSS —— 异步 worker（`StoryOssCleanupQueue` + `/api/story/kie/cleanup` 60s cron）
- [x] §13.5 OpenRouter `google/gemini-3-flash-preview` —— 先按此值落地，404 时运维改 `OPENROUTER_DEFAULT_MODEL`，候选 `google/gemini-2.5-flash-preview`；不阻塞 B0–B1
- [x] §13.6 本地回调 —— 不用 ngrok，本地 `STORY_AI_PUBLIC_BASE` 留空 → 不下发 callBackUrl，纯轮询；前端 5s tick 观察进度

---

## 风险登记

> 进行中如发现新风险，追加在此并打 `[!]`。

- [ ] [!] KIE 回调因公网不可达失败 —— 缓解：轮询 worker 兜底（B3.6）
- [ ] [!] OpenRouter 模型不可用 —— 缓解：`OPENROUTER_DEFAULT_MODEL` 可热切（B-1）
- [ ] [!] OSS 上传超时（视频 ≤160MB） —— 缓解：分级超时 + 重试 ≤2 次 + UI 显式失败态
- [ ] [!] 同一帧并发出图导致 OSS 串图 —— 缓解：OSS key 含 `uuid()`；任务表唯一约束保护
