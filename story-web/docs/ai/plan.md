# story-web 三期：AI 创作生产线 —— 完整需求与开发方案

> 范围：`/projects` 列表与新建、`/project/:id`「故事设定 / 分镜设定」两个工作台子页的完整后端逻辑、AI 流水线（KIE 托管 gemini-3-flash 文本 + KIE.AI 图像/视频）、OSS 持久化、回调/轮询双保险。
> 依赖：复用 `book-mall` 的 PostgreSQL（Prisma）、阿里云 OSS（`ali-oss`）、NextAuth 会话、`/api/story/*` CORS 边界。
> 风格一致性来源：`story-web/src/shared/styles/index.json`（每个 `styleId` 对应一段 prompt，必须在角色/分镜图提示词中拼接）。

---

## 0. 术语与缩写

| 术语 | 含义 |
|------|------|
| 项目 / Project | 一部漫剧的最小创作单元（含名称、描述、画幅比、风格、封面、大纲、角色、分镜） |
| 角色 / Character | 项目下的一个人物，含 `prompt` 与 `avatarUrl`（白底参考图） |
| 分镜 / Frame | 项目下的一个分镜节点，含场景、所选角色、`imagePrompt`、`videoPrompt`、生成的 `imageUrl`/`videoUrl` |
| KIE | `https://api.kie.ai`，统一 `createTask` + `recordInfo` 接口；`nano-banana-pro` 出图；视频用户可在弹层选 `bytedance/seedance-2`（默认）或 `wan/2-7-image-to-video`，**两者都是图生视频**。⚠️ 早期误用 `wan/2-7-image-pro`（图生图）/ `wan/2-7-text-to-video`（文生视频），均已纠正。 |
| KIE Gemini 3 Flash | KIE.AI 托管的 OpenAI 兼容 LLM 端点 `POST {KIE_API_BASE}/gemini-3-flash/v1/chat/completions`，鉴权与图像/视频共用同一把 `KIE_API_KEY`（详见 `story-web/docs/kie/gemini 3 Flash.md`） |
| Style Prompt | `src/shared/styles/index.json` 中按 `id` 取出的 `prompt` 字段，必须拼接进所有图像生成提示词以保证全局风格一致 |

---

## 1. 系统边界与跨工程协作

```
┌──────────────────────┐  HTTPS  ┌─────────────────────────────────┐
│ story-web (3003)     │ ──────▶ │ book-mall (3000)                │
│  - UI                │  cookie │  - Prisma (Neon PG)             │
│  - 调用 API          │ ◀────── │  - 阿里云 OSS (ali-oss)         │
│  - 不持久化业务数据  │         │  - KIE gemini-3-flash (LLM)     │
│  - 无敏感密钥        │         │  - KIE.AI (图/视频)             │
└──────────────────────┘         │  - 任务调度（cron / 轮询接口）  │
                                 └─────────────────────────────────┘
```

- 所有 **数据库 / OSS / 三方 AI / 计费** 调用归口 `book-mall`；story-web 仅做 UI 与 API 调用。
- 浏览器侧通过既有 `resolveBookMallBrowserRequest` 走同源代理 `/api/book-mall/*` 或跨源直连 `book-mall` Origin（依 `STORY_WEB_ORIGINS` 白名单）。
- 鉴权：所有 `/api/story/projects/*` 必须 `getServerSession(authOptions)`；未登录返回 401。
- KIE 回调地址必须是 **公网可访问** 的 `book-mall` 域（生产 `https://book.ai-code8.com/api/story/kie/callback/...`）；本地开发用 ngrok 或临时禁用回调，仅靠轮询。

---

## 2. 数据库设计（Prisma / book-mall）

> 迁移目录：`book-mall/prisma/migrations/<YYYYMMDDHHMMSS>_story_web_phase3/migration.sql`，对应 schema 改动追加在 `book-mall/prisma/schema.prisma` 末尾，并在 `doc/database/schema-changelog.md` 追加一条变更记录（遵循 book-mall 的 cursor rule）。

### 2.1 枚举

```prisma
enum StoryProjectAspect {
  RATIO_16_9   // 对应 "16:9"
  RATIO_9_16   // 对应 "9:16"
}

enum StoryProjectStatus {
  DRAFT             // 仅有名称/描述/风格
  INITIALIZING      // 一键初始化中（大纲/角色/封面 任一未完成）
  READY             // 大纲、角色、封面全部就绪
  ARCHIVED          // 软删
}

enum StoryGenerationKind {
  COVER_IMAGE
  CHARACTER_AVATAR
  FRAME_IMAGE
  FRAME_VIDEO
}

enum StoryGenerationStatus {
  PENDING       // 已落库未提交 KIE
  SUBMITTED     // 已提交 KIE，等待回调或轮询
  SUCCEEDED     // KIE success 且已落 OSS
  FAILED        // KIE fail 或 落库失败（含原因）
  CANCELLED     // 人工取消（保留扩展位）
}
```

### 2.2 主表

```prisma
/// 漫剧项目主表
model StoryProject {
  id             String              @id @default(cuid())
  userId         String
  user           User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  name           String
  description    String              @db.Text
  aspectRatio    StoryProjectAspect
  /// 关联 src/shared/styles/index.json 的 id（10 余种风格之一）
  styleId        Int

  /// 一键初始化产出，初始为空字符串
  storyOutline   String              @default("") @db.Text

  /// 封面图 OSS 公网 URL；初始为空，初始化流程产出
  coverImageUrl  String              @default("")
  /// 封面图当前生成任务（用于前端轮询/进度显示）
  coverTaskId    String?

  status         StoryProjectStatus  @default(DRAFT)
  /// 软删时间；查询默认 deletedAt is null
  deletedAt      DateTime?

  characters     StoryCharacter[]
  frames         StoryStoryboardFrame[]
  tasks          StoryGenerationTask[]

  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([userId, deletedAt, updatedAt])
  @@index([status])
}

/// 角色
model StoryCharacter {
  id             String              @id @default(cuid())
  projectId      String
  project        StoryProject        @relation(fields: [projectId], references: [id], onDelete: Cascade)

  /// 角色姓名（AI 生成或用户编辑）
  name           String
  /// 角色定位：主角 / 配角 / NPC 等（AI 自由产出）
  role           String              @default("")
  /// 角色简介（AI 产出，剧情向）
  description    String              @default("") @db.Text
  /// 角色外观提示词：发型/瞳色/服饰/神态/年龄/性别 等纯外观描述。
  /// **不含风格前缀**——调用 KIE 时由后端按当前 styleId 实时拼接 [STYLE]，避免风格切换或用户编辑造成漂移。
  /// 默认包含「白底、无场景」要求，便于后续作为 frame.image_input 保持一致性。
  imagePrompt    String              @db.Text
  /// 角色头像 OSS 公网 URL；初始空，等待 KIE 出图
  avatarUrl      String              @default("")
  /// 当前 avatarUrl 对应的生成任务（用于追溯/重试）
  avatarTaskId   String?

  /// 同项目下排序，影响列表展示顺序
  sortOrder      Int                 @default(0)

  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([projectId, sortOrder])
}

/// 分镜
model StoryStoryboardFrame {
  id                String         @id @default(cuid())
  projectId         String
  project           StoryProject   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  /// 第几格（1-based）
  index             Int
  /// 分镜标题（场景文字，前端列表卡片左上文本）
  sceneText         String         @default("")
  /// 详细描述：景别、对话、镜头、场景等
  sceneDescription  String         @default("") @db.Text
  /// 该分镜涉及的角色 id 列表（StoryCharacter.id），按出场先后
  characterIds      String[]       @default([])

  /// 分镜图 prompt：角色描述 + 场景描述（构图、机位、动作、对白氛围）。
  /// **不含风格前缀**——调用 KIE 时由后端按 styleId 实时拼接，避免风格切换/用户编辑后陈旧。
  imagePrompt       String         @db.Text
  /// 运镜 prompt（基于已生成的分镜图，描述如何运镜；不含风格）
  videoPrompt       String         @db.Text

  /// 分镜图 OSS 公网 URL（初始空）
  imageUrl          String         @default("")
  imageTaskId       String?

  /// 分镜视频 OSS 公网 URL（初始空）
  videoUrl          String         @default("")
  videoTaskId       String?

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@unique([projectId, index])
  @@index([projectId])
}

/// 统一的 KIE/AI 生成任务表（覆盖封面/角色/分镜图/分镜视频四类）
model StoryGenerationTask {
  id              String                 @id @default(cuid())
  /// 关联项目（角色/分镜任务也回写到对应表）
  projectId       String
  project         StoryProject           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  /// 关联的目标实体（按 kind 二选一）
  characterId     String?
  frameId         String?

  kind            StoryGenerationKind
  status          StoryGenerationStatus  @default(PENDING)

  /// KIE.AI 模型名：nano-banana-pro / bytedance/seedance-2
  model           String
  /// KIE 返回的 taskId（提交后填入，用于回调/轮询匹配）
  kieTaskId       String?                @unique
  /// 提交给 KIE 的完整 input（便于排查与重放）
  inputPayload    Json
  /// KIE 回调或 recordInfo 原始响应（最近一次）
  resultPayload   Json?
  /// KIE 返回的临时 URL（供 OSS 中转保留 24h 内载入痕迹）
  ephemeralUrl    String?
  /// 落 OSS 后的稳定 URL（成功时回写到目标实体相同字段）
  ossUrl          String?

  failCode        String?
  failMessage     String?

  /// 提交 KIE 时间 / 完成时间 / 最近一次轮询时间
  submittedAt     DateTime?
  completedAt     DateTime?
  lastPolledAt    DateTime?
  /// 已轮询次数，便于退避策略
  pollCount       Int                    @default(0)

  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@index([status, submittedAt])
  @@index([projectId, kind])
  @@index([characterId])
  @@index([frameId])
}

/// OSS 异步清理队列：删除项目 / 重新生成媒体时，旧的稳定 URL 会写入此表，由 cron worker 调 deleteManagedOssObjectByUrl 清理。
/// 不直接在请求线上同步删 OSS，避免删除接口阻塞。
model StoryOssCleanupQueue {
  id          String   @id @default(cuid())
  /// 调用方上下文（仅排查用，可空，例如 "project_delete:cuid_xxx"）
  source      String?
  /// 待清理的 OSS 公网 URL
  ossUrl      String
  /// 不要在该时间之前清理（用于"先生成新图再删旧图"的窗口期）
  notBefore   DateTime  @default(now())
  /// 已尝试次数；>=3 视为失败，等人工排查
  attempts    Int       @default(0)
  /// 最近一次尝试时间 / 错误
  lastTriedAt DateTime?
  lastError   String?
  /// 完成时间；非空即视为已清理（也可改为软删，本期直接保留作为审计）
  doneAt      DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([doneAt, notBefore])
}
```

### 2.3 关键约束与说明

- **软删**：`StoryProject.deletedAt` 非空即视为已删；列表 / 详情 API 默认过滤 `deletedAt is null`。
- **唯一性**：`StoryStoryboardFrame.@@unique([projectId, index])`，避免分镜重复编号。
- **任务表的索引**：`(status, submittedAt)` 用于轮询 worker 选取「SUBMITTED 且最久未轮询」的任务批量处理。
- **`characterIds` 用 String 数组**：Postgres 原生 text[]；查询主要按 `frameId` 取出后回前端 join（StoryCharacter 已在同一项目缓存），不必加额外多对多表（避免 N×M 维护成本，本期需求够用）。
  - 数据完整性：删除角色时，需在事务里 `UPDATE StoryStoryboardFrame SET characterIds = array_remove(characterIds, $1) WHERE projectId = $2`，避免脏 id。
- **`imagePrompt` 仅存"描述"**：风格 `style.prompt` **不落库到 Character/Frame**，由后端在调用 KIE 时按 `project.styleId` 实时拼接。这样：
  - 用户切换 styleId 立即生效；
  - 用户编辑 prompt 时不必小心保留风格段；
  - 历史 task 的 `inputPayload` 里仍可看到当时的完整 prompt（已含风格），便于审计与重放。
- **不存「画幅比 → 风格 url」冗余**：UI 渲染所需 `style.url`/`style.name_cn` 一律由 `styleId` 现读 `index.json`，避免风格表升级后的脏数据。
- **OSS 异步清理**：`StoryOssCleanupQueue` 由 cron worker 处理（plan §6.5）；删除请求接口立即返回，不阻塞用户。

---

## 3. 环境变量

新增（写入 `book-mall/.env.example` 占位、`book-mall/.env.local` 实际值）：

```
# KIE.AI 一把 key 同时管 LLM + 图像 + 视频：
#   - LLM：POST {KIE_API_BASE}/gemini-3-flash/v1/chat/completions（OpenAI Chat Completions 兼容）
#   - 图像：nano-banana-pro
#   - 视频：bytedance/seedance-2 (图生视频，5s 预览)
# 落地时从 story-web/.env.local 迁移至 book-mall/.env.local（实际调用方为 book-mall）。
KIE_API_KEY=
KIE_API_BASE=https://api.kie.ai
# 回调签名校验秘钥（自定义；下发到 KIE 的回调 URL 中带 ?token=<KIE_CALLBACK_TOKEN>）
KIE_CALLBACK_TOKEN=

# 可选：覆盖 LLM 端点（默认走 ${KIE_API_BASE}/gemini-3-flash/v1/chat/completions）
STORY_AI_GEMINI_ENDPOINT=

# 轮询/回调地址基址。
#  - 生产：book-mall 公网（如 https://book.ai-code8.com），用于回调 + 自身轮询
#  - 本地：留空或写 http://localhost:3000，本地不下发 callBackUrl，全靠 poll worker（决议 §13.6）
STORY_AI_PUBLIC_BASE=
# 轮询 worker 触发的保护 token（同 finance-web 类似的 cron 触发）
STORY_AI_POLL_TOKEN=
# 上游并发软上限（避免单租户压垮 KIE 文本 / 图像 / 视频）
STORY_AI_LLM_MAX_CONCURRENCY=5
STORY_AI_KIE_MAX_CONCURRENCY=10
STORY_AI_USER_INFLIGHT_MAX=50
```

OSS 沿用 book-mall 既有：`OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_REGION / OSS_ENDPOINT / OSS_PUBLIC_URL_BASE`。

> **next.config.mjs 图片白名单**：`story-web/next.config.mjs` 的 `images.remotePatterns` 必须新增 OSS 域名（否则 next/image 显示 404）。
> - `<bucket>.<region>.aliyuncs.com`（默认虚拟域名）
> - `OSS_PUBLIC_URL_BASE` 自定义 CDN 域名（若启用）

> **执行预告**：落地阶段会改 `book-mall/.env.example`（新增占位）与 `book-mall/.env.local`（写入实际值），不会改任何含密钥的现有键；同时把 `story-web/.env.local` 里的 `KIE_API_KEY` 注释掉以避免误用。具体动作发生时会再次预告。

---

## 4. 后端 API 设计（全部位于 `book-mall`）

> 路由前缀统一 `/api/story/projects`，CORS 复用 `book-mall/lib/story/cors.ts`（`STORY_WEB_ORIGINS` 白名单）。响应头统一 `Cache-Control: private, no-store`，避免代理层缓存。

| Method | Path | 说明 |
|--------|------|------|
| `GET`  | `/api/story/projects` | 当前用户项目列表（按 `updatedAt desc`） |
| `POST` | `/api/story/projects` | 新建项目（仅保存名称/描述/画幅比/styleId，其他字段默认值） |
| `GET`  | `/api/story/projects/:id` | 项目基本信息（含角色、分镜、所有任务最新状态） |
| `PATCH`| `/api/story/projects/:id` | 修改项目元信息（名称/描述/styleId/画幅比，仅 DRAFT 阶段允许改 styleId） |
| `DELETE`| `/api/story/projects/:id` | **二次确认后**软删（`deletedAt` 写入），异步触发 OSS 资源清理 |
| `POST` | `/api/story/projects/:id/initialize` | 一键初始化：大纲 → 角色 → 角色图 + 封面图（提交所有 KIE 任务）。可空 body 或 `{ characterCount: 3 \| 5 \| 8 }`（默认 5） |
| `POST` | `/api/story/projects/:id/storyboard/generate` | 一键生成 N 个分镜（`count ∈ {3,5,8}`，默认 5；仅产出文本与提示词，不生成图/视频） |
| `POST` | `/api/story/projects/:id/frames/:frameId/image` | 提交分镜图生成任务（KIE nano-banana-pro，传角色头像 URL） |
| `POST` | `/api/story/projects/:id/frames/:frameId/video` | 提交分镜视频生成任务（KIE `bytedance/seedance-2` 图生视频，1080p / 5s / 不带音频） |
| `PATCH`| `/api/story/projects/:id/characters/:characterId` | 编辑角色（姓名/描述/imagePrompt） |
| `POST` | `/api/story/projects/:id/characters/:characterId/avatar` | 重新生成角色头像（重新提交 KIE 任务） |
| `POST` | `/api/story/projects/:id/cover` | 重新生成封面 |
| `PATCH`| `/api/story/projects/:id/frames/:frameId` | 编辑分镜文本/角色绑定/imagePrompt/videoPrompt |
| `GET`  | `/api/story/projects/:id/tasks` | 拉取项目下所有任务最新状态（前端轮询时用） |
| `POST` | `/api/story/kie/callback/:kind` | KIE 回调入口（`:kind` ∈ `image / video`），`?token=` 校验 |
| `POST` | `/api/story/kie/poll` | 内部轮询 worker 触发器（`Authorization: Bearer ${STORY_AI_POLL_TOKEN}`） |

### 4.1 请求/响应示例（关键接口）

#### 4.1.1 `POST /api/story/projects`

请求：
```json
{
  "name": "星尘旅人",
  "description": "...",
  "aspectRatio": "16:9",
  "styleId": 4
}
```

响应（201）：
```json
{
  "project": {
    "id": "ckxx...",
    "name": "星尘旅人",
    "description": "...",
    "aspectRatio": "16:9",
    "styleId": 4,
    "status": "DRAFT",
    "storyOutline": "",
    "coverImageUrl": "",
    "characters": [],
    "frames": [],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### 4.1.2 `GET /api/story/projects/:id`

响应（200）：
```json
{
  "project": { ...同上，但带 characters[] / frames[] / 进行中任务 ... },
  "pendingTasks": [
    { "id": "tsk_xxx", "kind": "COVER_IMAGE", "status": "SUBMITTED", "kieTaskId": "task_..." }
  ]
}
```

#### 4.1.3 `POST /api/story/projects/:id/initialize`

- 同步部分（请求内必须返回，不阻塞 KIE）：
  1. KIE `gemini-3-flash` 调一次大纲 LLM；
  2. KIE `gemini-3-flash` 调一次角色抽离 LLM，落库 `StoryCharacter[]`；
  3. 为每个角色与封面创建 `StoryGenerationTask(PENDING)` → 立刻调用 KIE `createTask` → 写入 `kieTaskId` 与 `status=SUBMITTED`；
  4. 项目 `status` 置为 `INITIALIZING`；
- 响应：
```json
{
  "project": { ... },
  "tasks": [
    { "id": "tsk_a", "kind": "COVER_IMAGE", "status": "SUBMITTED", "kieTaskId": "..." },
    { "id": "tsk_b", "kind": "CHARACTER_AVATAR", "characterId": "...", "kieTaskId": "..." }
  ]
}
```

> **失败回退**：大纲/角色 LLM 失败 → 项目保持 `DRAFT` 不动，整体接口 `5xx`；只要 LLM 成功即把角色与文本落库；后续 KIE 失败不影响文本结果，前端可按角色卡片单独「重试出图」。

#### 4.1.4 `POST /api/story/projects/:id/storyboard/generate`

- 入参：`{ count?: 3 | 5 | 8, force?: boolean }`，`count` 仅接受三档枚举（默认 5；非 3/5/8 直接 400）。
- 调 LLM 一次性产出 `frames[]`（见第 5.3 系统提示词）；落库后返回完整 `frames` 列表。
- 若已有分镜数据，请求体需带 `force=true`，且必须前端做二次确认（见 §10）。
- `force=true` 时旧 frames 的 `imageUrl` / `videoUrl` 会被入清理队列（`StoryOssCleanupQueue`，`notBefore = now()`）。

#### 4.1.5 `POST /api/story/projects/:id/frames/:frameId/image`

- 服务端从 frame 取 `imagePrompt`（仅含场景/角色描述），按当前 `project.styleId` 实时拼装 `[STYLE]` 前缀；从 `characterIds` 拉对应 `StoryCharacter.avatarUrl`（缺图视为 409）；按 KIE nano-banana-pro 规范提交：
```json
{
  "model": "nano-banana-pro",
  "callBackUrl": "${STORY_AI_PUBLIC_BASE}/api/story/kie/callback/image?token=${KIE_CALLBACK_TOKEN}&taskRef=${tsk_id}",
  "input": {
    "prompt": "[STYLE] {style.prompt}\n[CHARACTERS] ...\n[SCENE] {frame.imagePrompt}",
    "image_input": ["<character1.avatarUrl>", "<character2.avatarUrl>"],
    "aspect_ratio": "<project.aspectRatio>",
    "resolution": "2K",
    "output_format": "png"
  }
}
```
- `STORY_AI_PUBLIC_BASE` 为空时不下发 `callBackUrl`，纯靠 poll worker 兜底（本地决议）。
- 同步返回 `{ task: {...SUBMITTED...} }`；前端进入轮询 `/tasks` 直到 `SUCCEEDED` → 刷新 frame.imageUrl。

#### 4.1.6 `POST /api/story/projects/:id/frames/:frameId/video`

- 必须 `frame.imageUrl` 已就绪（否则 409）。
- 提交 KIE `bytedance/seedance-2`（图生视频）：
```json
{
  "model": "bytedance/seedance-2",
  "callBackUrl": "${STORY_AI_PUBLIC_BASE}/api/story/kie/callback/video?token=...&taskRef=tsk_id",
  "input": {
    "prompt": "<videoPrompt>",
    "reference_image_urls": ["<frame.imageUrl>"],
    "aspect_ratio": "<project.aspectRatio>",
    "resolution": "1080p",
    "duration": 5,
    "generate_audio": false
  }
}
```
> **历史教训**：此前曾用 `wan/2-7-image-pro` —— 但 KIE 文档明确说明它只做「图生图 / 图编辑」（产 png）。改用 `bytedance/seedance-2` 才是真正的图生视频。
>
> Wan 系列正确的图生视频模型是 `wan/2-7-image-to-video`（首帧 = `first_frame_url` 单张），而 `wan/2-7-text-to-video` 是文生视频（不读首帧），漫剧分镜场景一律走前者以保留画面一致性。
> `duration` 取 5 秒、关闭 `generate_audio` 是为了控制费用与回看体验。
- `STORY_AI_PUBLIC_BASE` 为空时不下发 `callBackUrl`，靠 poll worker 兜底。

#### 4.1.7 `POST /api/story/kie/callback/:kind`

- 校验 `?token=KIE_CALLBACK_TOKEN`（不通过返回 401 不暴露细节）。
- 根据 `taskRef`（query）+ payload 中的 `data.taskId` 匹配 `StoryGenerationTask`；幂等：若该 task 已是 `SUCCEEDED` 则直接返回 200。
- 成功分支：从 `resultJson.resultUrls[0]` 拿 ephemeralUrl → 下载 → 上传 OSS → 写回目标实体（`coverImageUrl` / `avatarUrl` / `imageUrl` / `videoUrl`）→ task 状态 `SUCCEEDED`。
- 失败分支：写 `failCode/failMessage`，task 状态 `FAILED`；不抛 5xx（避免 KIE 重试风暴），返回 200 让 KIE 不再重试。

#### 4.1.8 `POST /api/story/kie/poll`

- 用 `Authorization: Bearer $STORY_AI_POLL_TOKEN` 校验。
- 选取 `status=SUBMITTED` 且 `(lastPolledAt is null OR lastPolledAt < now() - interval)` 的任务，每次最多 20 个并发查询。
- 退避策略：`interval = min(60s × 2^pollCount, 10min)`，`pollCount` 自增；累计提交后超过 20 分钟仍未 success 视为 `FAILED(timeout)`。
- 成功/失败分支等同 §4.1.7 处理逻辑（共用同一个 `applyKieTaskResult` 服务函数）。

> **失败重试入口**：所有 `FAILED` 任务保留在表中；前端在角色 / 分镜卡片上提供「重试」按钮，调用对应的 `*/avatar` `*/image` `*/video` 接口创建一笔新的任务（旧 task 不再轮询）。

> **OSS 上传失败的兜底**：回调/轮询拿到 `success` 后下载 ephemeralUrl + 上传 OSS 这一步 **本地重试 ≤ 2 次**（指数退避 0.5s/2s）；仍失败时 task 标记为 `FAILED` 且 `ephemeralUrl` 写入 `resultPayload`，避免 24h 后丢失原图。前端「重试」按钮会重新创建一笔新 KIE 任务（不复用旧 ephemeralUrl，因为可能已过期）。

> **上游并发软上限**（来自 §3 环境变量）：
> - 每用户 inflight `StoryGenerationTask(SUBMITTED + PENDING) ≤ STORY_AI_USER_INFLIGHT_MAX`；超过时新提交直接 429。
> - `submitGenerationTask` 内部用进程内 semaphore 限制对 KIE 文本 / 图像 / 视频端点的同时连接数（多副本部署时取 ceil(全局上限 / 副本数)）。

---

## 5. AI 工作流详解

### 5.1 文本调用统一约定（KIE Gemini 3 Flash）

- 入口：`book-mall/lib/story/gemini-llm-client.ts`
  - `chatJson<T>({ systemPrompt, userPrompt, schema, reasoningEffort? })` —— POST `${KIE_API_BASE}/gemini-3-flash/v1/chat/completions`，OpenAI Chat Completions 兼容；强制 `stream: false / include_thoughts: false / response_format: { type: "json_object" }`；JSON.parse 前先去掉 ``` 代码块包裹；Zod 校验失败时重试 1 次。
  - 端点可被 `STORY_AI_GEMINI_ENDPOINT` 覆盖（自部署 OpenAI 兼容网关时使用）。
  - `reasoningEffort` 默认 `"low"`（速度优先），复杂场景可显式传 `"high"`。
- 通用 system 前缀：
  > `你是漫剧 AI 编剧助手。所有输出必须是单个合法 JSON 对象，禁止任何额外解释、Markdown 代码块、注释。字段名严格按用户给定 schema。`

### 5.2 一键初始化（`/initialize`）

#### 5.2.1 第一步：故事大纲

- system（节选）：
  > 你是漫剧编剧。请根据「项目名称」「项目描述」生成一份完整的故事大纲。
  > 大纲要求：
  > 1. 包含完整三幕的故事情节（起承转合），不少于 600 字；
  > 2. 在大纲文末单独列出「人物表」（中文姓名 + 一句话身份），所有出场人物都必须在人物表中出现；
  > 3. 不得使用 markdown 标题语法或代码块；
  > 4. 输出 JSON：`{"outline": "<纯文本，含人物表>"}`
- 落库：写入 `StoryProject.storyOutline`，`status` → `INITIALIZING`。

#### 5.2.2 第二步：角色抽离 + 提示词合成

- system（节选）：
  > 给定漫剧故事大纲，请抽出所有出场角色，并为每个角色生成画像 prompt。
  > 输出 JSON：
  > ```json
  > {
  >   "characters": [
  >     {
  >       "name": "中文姓名",
  >       "role": "主角 / 配角 / NPC ...",
  >       "description": "150 字以内剧情向背景",
  >       "appearance": "用于画像的纯外观描述：发型、瞳色、服饰、神态、年龄段、性别"
  >     }
  >   ]
  > }
  > ```
  > 限制：character 数量 3–8 个，按重要性排序。
- 服务端处理：
  - **落库的 `imagePrompt` 仅含外观/构图/白底**（不含 [STYLE]，调用 KIE 时由 `buildKieImagePrompt(project, character)` 实时拼接风格）：
    ```ts
    // 落库版本（用户可见可编辑）
    const imagePrompt = [
      `[CHARACTER] ${appearance}`,
      `[COMPOSITION] full body / half body portrait, neutral pose, looking at viewer`,
      `[BACKGROUND] pure white background, no scene, no props, no text`,
      `[QUALITY] high detail, crisp lines, consistent character design for series use`,
    ].join("\n");

    // 调 KIE 时（不入库）
    const finalPrompt = `[STYLE] ${getStyleById(project.styleId).prompt}\n${imagePrompt}`;
    ```
  - **白底要求保留**：不是画幅约束，而是为后续作为 frame `image_input` 时角色一致性更稳。
  - 风格 prompt 由 styleId 实时计算 → 切换 styleId 立即生效；用户编辑 imagePrompt 时无需关心风格段。
- 落库：批量 `createMany`，`sortOrder` 按返回顺序 0..n。

#### 5.2.3 第三步：封面图 + 角色头像 → KIE 提交

- 封面图 prompt（不入库，调用时拼装）：
  ```
  [STYLE] {style.prompt}
  [SUBJECT] {project.name} 漫剧封面，呈现核心冲突氛围
  [REFERENCE] 大纲：{outline 摘要 200 字}
  [LAYOUT] 主视觉构图，留出漫剧标题位
  ```
  - `aspect_ratio` 跟随项目（`16:9` / `9:16`），`resolution=2K`，`output_format=png`。
- 角色头像：取 `StoryCharacter.imagePrompt` 实时拼接 `[STYLE]`，`aspect_ratio` **跟随项目**（决议 §13.1 不强制 1:1），不传 `image_input`（首次出图无参考）。
- 每条 KIE 任务对应一条 `StoryGenerationTask(PENDING)`，提交成功后写入 `kieTaskId`，状态 → `SUBMITTED`。
- 提交失败（HTTP 非 200 / `code != 200`）：保留 `PENDING` 并写 `failMessage`，等待轮询 worker 重新提交（最多 3 次）。

### 5.3 分镜生成（`/storyboard/generate`）

- 入参：`{ count?: 3 | 5 | 8, force?: boolean }`，默认 5；非三档值返回 400。前端在分镜空态按钮上以下拉选择呈现（决议 §13.2）。
- 取项目数据：`name / description / storyOutline / styleId / characters[]`。
- system（节选）：
  > 你是漫剧分镜师。请根据故事大纲与角色列表，生成 `count` 个分镜。
  > 输出 JSON：
  > ```json
  > {
  >   "frames": [
  >     {
  >       "index": 1,
  >       "sceneText": "10 字以内场景标题",
  >       "sceneDescription": "100~200 字：景别（特写/中景/全景）、地点、时间、角色站位、对话/独白、情绪",
  >       "characterNames": ["林晚", "陈启"],
  >       "imagePrompt": "用于生成单镜静态图的英文/中文混排 prompt（不含风格，由后端拼接）。请聚焦：构图、人物动作、表情、镜头语言、关键道具、色调。",
  >       "videoPrompt": "用于将该静态分镜图驱动成视频的运镜与动效描述：镜头如何移动、人物如何动起来、节奏。20–80 字。"
  >     }
  >   ]
  > }
  > ```
  > 约束：
  > 1. `frames` 长度严格等于 `count`；
  > 2. `characterNames` 必须来自给定角色列表；
  > 3. 各分镜按时间顺序推进剧情；
  > 4. 不要在 imagePrompt / videoPrompt 中重复描述风格（风格由后端拼接）。
- 服务端后处理：
  - `characterNames` → 映射到 `StoryCharacter.id`（找不到的角色丢弃但记录 warning）；
  - **落库的 `frame.imagePrompt` 保留 LLM 原文 + 角色描述**（不含 [STYLE]）：
    ```
    [CHARACTERS]
      - {char.name}: {char.imagePrompt 中的外观摘要}
    [SCENE] {LLM 产出的 imagePrompt}
    [CONSISTENCY] keep characters' appearance consistent with reference avatars
    ```
  - 调 KIE 时由 `buildKieFrameImagePrompt(project, frame, characters)` 实时 prepend `[STYLE]`。
  - `videoPrompt`：保留 LLM 原文，不做后处理（图生视频不依赖风格 prompt，过多文字反而干扰运镜）。
  - `index = 1..count`；`force=true` 时同事务：把旧 frames 的 `imageUrl` / `videoUrl` 写入 `StoryOssCleanupQueue` → `deleteMany frames` → `createMany`。

### 5.4 单分镜出图（`/frames/:id/image`）

- 校验：`frame.characterIds.length > 0` 且每个角色 `avatarUrl` 非空（否则 409 提示先生成角色图）。
- KIE 输入：见 §4.1.5；最多 8 个 `image_input` URL（KIE 限制），多于 8 个截断并记录 warning。
- 任务状态机：`PENDING → SUBMITTED → SUCCEEDED/FAILED`，UI 在 `SUCCEEDED` 后从 `frame.imageUrl` 拉取最终图。

### 5.5 单分镜出视频（`/frames/:id/video`）

- 校验：`frame.imageUrl` 必须非空。
- KIE `bytedance/seedance-2` 走图生视频：见 §4.1.6。
- `duration=5` 秒、`resolution=1080p`、`generate_audio=false`；视频用作分镜预览，无需音频与冗长时长。

---

## 6. KIE 任务调度（回调 + 轮询双保险）

### 6.1 状态机

```
                 createTask 200          callback success / poll success
PENDING ────────────▶ SUBMITTED ─────────────────▶ SUCCEEDED
   │                       │
   │ createTask 5xx        │ callback fail / poll fail / timeout
   ▼                       ▼
 retry≤3                 FAILED
```

### 6.2 回调实现要点

- 路由：`POST /api/story/kie/callback/:kind`，`:kind ∈ image | video`。
- Query：`token`（必须等于 `KIE_CALLBACK_TOKEN`）、`taskRef`（我们落库的 `StoryGenerationTask.id`）。
- Body：与 `recordInfo` 响应同结构（KIE 文档明确）。
- 处理流程（pseudo）：
  ```ts
  async function handleKieCallback(kind, taskRef, body) {
    const task = await prisma.storyGenerationTask.findUnique({ where: { id: taskRef } });
    if (!task) return 200; // 幂等
    if (task.status === "SUCCEEDED") return 200;
    if (body.data.state === "success") {
      const url = JSON.parse(body.data.resultJson).resultUrls?.[0];
      const ossUrl = await persistKieResultToOss(url, kind);
      await applyKieResult(task, { ossUrl, ephemeralUrl: url, payload: body });
    } else if (body.data.state === "fail") {
      await markFailed(task, body.data.failCode, body.data.failMsg);
    } // 其他状态忽略
    return 200;
  }
  ```
- **必须返回 200**（即使内部失败也要静默成功 + log），否则 KIE 会反复重试，造成数据库写入抖动。

### 6.3 轮询 worker

- 触发方式（任选其一，推荐①）：
  1. **腾讯云托管定时任务**（生产）：每 30 秒 POST `/api/story/kie/poll`，带 `Authorization: Bearer $STORY_AI_POLL_TOKEN`；
  2. 本地：`pnpm story:poll-once` 脚本（`book-mall/scripts/story-ai-poll.ts`）手动跑一次；
  3. 退路：前端打开项目页时如果 `pendingTasks` 非空，自带 5s 轮询 `/api/story/projects/:id/tasks`，会触发后端「按需 poll」（首次进入即时拉一次 KIE）。
- 单次执行限额：每次最多处理 20 条任务，单条超时 8s（KIE recordInfo 一般亚秒级）。
- 退避：`interval = min(2s * 2^pollCount, 60s)`，`pollCount` 写表；超 20 分钟仍未 success → `FAILED(timeoutAt: now)`。
- **本地开发模式**（决议 §13.6）：`STORY_AI_PUBLIC_BASE` 为空时不下发 `callBackUrl` 给 KIE，纯靠 poll worker。前端 `/tasks` 5s 轮询 + 后端按需主动拉 `recordInfo`，足以在开发期观察生成进度。

### 6.4 OSS 中转

- 复用 `tool-web/lib/ai-fit-oss-upload.ts` 同款工具，新建 `book-mall/lib/story/story-oss.ts`：
  - `persistKieImageToOss(url, { projectId, kind, refId }) → ossUrl`：图片下载 + put `story/{kind}/{projectId}/[refId/]{uuid}.{ext}`；
  - `persistKieVideoToOss(url, { projectId, frameId }) → ossUrl`：视频下载 + put，限 160MB。
- OSS key 规则：
  - 封面：`story/cover/{projectId}/{uuid}.png`
  - 角色：`story/character/{projectId}/{characterId}/{uuid}.png`
  - 分镜图：`story/frame-image/{projectId}/{frameId}/{uuid}.png`
  - 分镜视频：`story/frame-video/{projectId}/{frameId}/{uuid}.mp4`
- ACL：`public-read`，公网 URL 通过 `OSS_PUBLIC_URL_BASE` 优先返回；删除时仍走 `deleteManagedOssObjectByUrl`。
- **下载 + 上传的本地重试**：`fetch ephemeral URL → buffer → put OSS` 这一段失败时本地重试 ≤ 2 次（指数退避 0.5s/2s）；都失败再 markFailed 并把 `ephemeralUrl` 写进 `resultPayload`。
- **next.config.mjs 白名单**：story-web `images.remotePatterns` 必须新增 `<bucket>.<region>.aliyuncs.com` 与 `OSS_PUBLIC_URL_BASE` 主机名（否则 next/image 报 host not configured）。

### 6.5 OSS 异步清理 worker

- 触发方式：`POST /api/story/kie/cleanup`，`Authorization: Bearer $STORY_AI_POLL_TOKEN`（与 poll 复用 token），生产 1 分钟一次。
- 选取条件：`StoryOssCleanupQueue` 中 `doneAt is null AND notBefore <= now() AND attempts < 3`，每次 ≤ 50 条；并发 ≤ 5。
- 处理：调 `deleteManagedOssObjectByUrl(ossUrl)`；成功 → 写 `doneAt`；失败 → `attempts += 1`，写 `lastError`；attempts ≥ 3 后停手等人工排查。
- 入队场景：
  - 项目软删：把项目下所有 cover / character avatar / frame image / frame video 的 ossUrl 入队，`source = "project_delete:{projectId}"`；
  - 单角色 / 单分镜删除：对应资源 ossUrl 入队；
  - 媒体重新生成（封面/头像/分镜图/视频）：旧 ossUrl 入队，`notBefore = now() + 5min`，给 CDN 回源以及任何残留前端缓存留窗口。

### 6.6 日志脱敏

- `callBackUrl` 中的 `?token=...` 写日志/Datadog/error tracker 前要替换为 `?token=***`。
- KIE 错误日志保留 `failCode / failMsg / kieTaskId / model`，不打印 `KIE_API_KEY`。

---

## 7. 前端改造（story-web）

> 总原则：去掉 `lib/projects/store.ts` 的 localStorage 实现，改写为 fetch `book-mall` API。`lib/projects/types.ts` 字段在不破坏 UI 的前提下扩展（新增 `coverImageUrl`、`status`、`avatarUrl` 与 `imagePrompt`、`pendingTasks` 等）。

### 7.1 `lib/projects/api.ts`（新增）

- 统一封装 `resolveBookMallBrowserRequest` + JSON 序列化；导出：
  - `listProjects()` / `createProject(input)` / `getProject(id)` / `patchProject(id, patch)` / `deleteProject(id)`
  - `initializeProject(id)` / `generateStoryboard(id, count?)` / `generateFrameImage(id, frameId)` / `generateFrameVideo(id, frameId)`
  - `regenerateAvatar(id, characterId)` / `regenerateCover(id)`
  - `getProjectTasks(id)`
- 错误统一抛 `BookMallApiError(code, msg)`，UI 层用 toast。

### 7.2 `/projects` 页面

- `projects-page-client.tsx`：
  - 进入时调 `listProjects()`；加载态显示骨架卡（`<div className="aspect-video animate-pulse rounded-xl bg-white/5">` × 6）；
  - 列表为空：现有空态文案保留；
  - 列表项：复用现有 `ProjectCard`，`coverUrl` 取后端 `coverImageUrl || styleFallbackUrl`（仍可读 styles.json）；
  - 删除入口：项目卡片右上 `…` 菜单 → 「删除项目」（按 §10 二次确认）。
- `/projects/new` 提交：调 `createProject` → `router.push('/project/{id}')`。

### 7.3 `/project/:id`「故事设定」

- 新进入：fetch `getProject(id)` → 设置加载骨架（封面、大纲、角色三块各自骨架）；
- **若 `storyOutline === ""`**：渲染**全局空态**——一张大卡，CTA「✨ 一键初始化故事」：
  - 点击 → `initializeProject(id)`；进入「初始化中」全局状态；
  - 显示进度条 / loading（前端不必精确，按阶段：`大纲生成中…` `角色生成中…` `角色图与封面生成中…`，最后阶段调 `getProjectTasks` 实时刷新）；
  - 任意阶段失败：弹 toast，提供「重试」按钮（重新调 `/initialize`，后端发现 outline 已存在则跳过 LLM 直接补图）。
- **若 `storyOutline` 非空**：渲染封面图卡 + 大纲卡 + 角色横排卡（保持现有 UI）。
  - 角色 `avatarUrl` 为空但有 `avatarTaskId`：显示「生成中」骨架 + 旋转 loader；点 「重试」可重新提交；
  - 角色卡可点开「编辑」抽屉 → 修改名称 / 描述 / imagePrompt → 保存 → 「重新出图」按钮；
  - 封面同理：未就绪显示骨架，提供右上角 ⟳ 重新生成。

### 7.4 `/project/:id`「分镜设定」

- fetch `frames` 列表；
- **空态**：保留现有「一键出分镜」按钮 + 数量选择器（3 / 5 / 8，默认 5），调 `generateStoryboard(id, count)`。
- **有数据**：列表渲染（保留现有卡片样式）。每张卡：
  - 「分镜图」未就绪 → 显示占位 + 「生成分镜图」按钮（调 `/frames/:id/image`），生成中显示 loader 与 hint「使用 nano-banana-pro 生成中…」；
  - 「分镜视频」按钮在 `imageUrl` 就绪后才可点；生成中同样 loader；
  - 编辑 imagePrompt / videoPrompt 沿用现有 `PromptEditModal`，保存调 `PATCH /frames/:id`；
    - 编辑 imagePrompt 时**不显示风格段**（风格由后端按 styleId 实时拼接，用户切换 styleId 即生效）；
  - 角色绑定编辑：抽屉中复选 project.characters，保存后重新生成 imagePrompt（前端只更新角色块，风格在后端调用时拼接）。
- 任务进行中时启用 5s 轮询 `getProjectTasks(id)`：所有 task 终态后停止。
- 「重新出分镜」按钮：会触发二次确认 modal（旧 frames 的 OSS 文件入清理队列，见 §10）。

### 7.5 类型适配

`lib/projects/types.ts` 改造为后端 DTO 形态（仅展示关键差异）：
```ts
export type ProjectCharacter = {
  id: string;
  name: string;
  role: string;
  description: string;
  /// 角色外观/构图/白底描述（不含风格段）；编辑时不展示风格
  imagePrompt: string;
  avatarUrl: string;       // "" 表示未就绪
  avatarTaskStatus?: "SUBMITTED" | "FAILED" | null;
};

export type StoryboardFrame = {
  id: string;
  index: number;
  sceneText: string;
  sceneDescription: string;
  characterIds: string[];
  imagePrompt: string;
  videoPrompt: string;
  imageUrl: string;
  videoUrl: string;
  imageTaskStatus?: "SUBMITTED" | "FAILED" | null; // 新增
  videoTaskStatus?: "SUBMITTED" | "FAILED" | null; // 新增
};

export type ComicProject = {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  styleId: number;
  status: "DRAFT" | "INITIALIZING" | "READY" | "ARCHIVED";
  storyOutline: string;
  coverImageUrl: string;
  characters: ProjectCharacter[];
  storyboardFrames: StoryboardFrame[];
  createdAt: string;
  updatedAt: string;
};
```

### 7.6 骨架屏与 loading 规范

- 全屏骨架：`min-h-screen` 内 `Loader2` + 文案；
- 局部骨架：`animate-pulse` + 同 aspect ratio 占位；
- 任何 fetch 都使用 `cache: "no-store"` + `credentials` 已由 `resolveBookMallBrowserRequest` 处理。

---

## 8. 错误处理与边界

| 场景 | 处理 |
|------|------|
| LLM 返回非合法 JSON | 服务端重试 1 次（temperature ↑），仍失败 → 502 + 提示「AI 解析失败，请重试」 |
| LLM 角色数量超出 3–8 | 截断为 8（保留前 8）；不报错 |
| LLM 输出的角色姓名与"人物表"不一致 | 以 `characters` 数组为准（姓名权威），大纲文本不改 |
| KIE `createTask` 返回 `code != 200` | task 状态 `PENDING`，`failMessage` 写入；轮询 worker 重试 ≤ 3 次 |
| KIE 长时间未完成（>20 分钟） | 标记 `FAILED`（写 `failCode = "timeout"`），前端显示「生成超时，请重试」 |
| 用户在初始化未完成期间刷新页面 | `getProject` 仍能渲染部分就绪资源；未就绪用骨架；后端轮询继续推进 |
| 用户删除项目 | 软删立即返回；OSS 资源入 `StoryOssCleanupQueue`，由 cron worker 异步清理 |
| 同一帧重复点「生成图」 | 若已有 SUBMITTED 任务，直接 409；前端在按钮上禁用 + 显示「生成中」 |
| 角色 / 分镜 `imagePrompt` 被用户改为空 | 前端表单校验 + 后端 400（`code: "EMPTY_PROMPT"`） |
| KIE LLM 配额不足 | 502 + `code: "LLM_QUOTA_EXCEEDED"`，前端提示充值 |
| KIE LLM 端点 404 | 502 + `code: "LLM_MODEL_NOT_FOUND"`，提示运维检查 `KIE_API_BASE` 或 `STORY_AI_GEMINI_ENDPOINT`（决议 §13.5） |
| OSS 上传失败 | 本地重试 ≤ 2 次；仍失败 → task `FAILED`，`resultPayload.ephemeralUrl` 保留；前端显示「重试」并附调试入口 |
| 删除角色后该角色仍出现在某 frame.characterIds | 服务层 transaction 内 `array_remove`；前端拿到响应后会自动刷新 frames |
| 用户已有 `STORY_AI_USER_INFLIGHT_MAX` 笔活跃任务 | 新提交直接 429，`code: "TOO_MANY_INFLIGHT"` |
| KIE 回调签名错误 / token 不匹配 | 401 + 不带细节；server 端记 warn 日志（脱敏 token） |

---

## 9. 安全与鉴权

- 所有 `/api/story/projects/*` 校验 `getServerSession`；非登录用户 401。
- 资源所属：每个查询附带 `userId = session.user.id` 过滤；详情接口若发现 `project.userId !== session.user.id` → 404（不暴露存在）。
- 回调入口：`KIE_CALLBACK_TOKEN` 校验；后端额外校验 `taskRef` 与 `data.taskId` 是否匹配，防止伪造。
- 轮询入口：`Authorization: Bearer $STORY_AI_POLL_TOKEN`，仅供 cron 调用。
- 不在前端暴露 `KIE_API_KEY`；story-web 仅通过 book-mall API 间接消费。
- CORS：复用 `book-mall/lib/story/cors.ts` 的 `STORY_WEB_ORIGINS` 白名单；本地 + 生产域名各加一项。

---

## 10. 删除与二次确认（强制规范）

按工作区规则（`destructive-delete-confirmation.mdc`）：

| 删除入口 | 第一次确认文案 | 第二次确认文案 |
|----------|----------------|----------------|
| 项目删除 | 「将从我的创作室删除项目《{name}》」 | 「该操作不可恢复，并会从云端存储（OSS）清理所有封面、角色、分镜图与分镜视频，确认继续？」 |
| 单角色删除（如有） | 「将删除角色《{name}》及其头像」 | 「不可恢复，并会清理云端存储（OSS）中的头像。确认？」 |
| 单分镜删除 | 「将删除分镜 #{index} 及其图/视频」 | 「不可恢复，并会清理云端存储（OSS）中的分镜图与视频。确认？」 |
| 重新生成（覆盖旧资源） | 「将重新生成并覆盖旧的{资源名}」 | 「旧版本不可恢复（云端存储 OSS 中的旧文件会被替换/删除），确认继续？」 |

实现：使用项目内已有 modal 组件做两次确认，二次确认按钮颜色用红色破坏型；禁止单次 `confirm()`。

---

## 11. 实施分批（建议）

| 批次 | 内容 | 验收 |
|------|------|------|
| **B0 数据建模** | Prisma schema 增量、迁移 SQL、`prisma generate`；book-mall 启动通过 | `pnpm db:migrate status` 干净；新表可在 admin 可见 |
| **B1 项目 CRUD** | `/api/story/projects` GET/POST/GET:id/PATCH/DELETE；story-web `/projects` 列表与新建联通后端 | UI 上能新建、看见列表、刷新保留 |
| **B2 LLM 流水线** | `gemini-llm-client.ts`（KIE 托管 gemini-3-flash）；`/initialize` 大纲 + 角色（无 KIE 出图）；前端「一键初始化」直到产出文本即可 | 角色与大纲落库；UI 渲染就绪 |
| **B3 KIE 出图** | `kie-client.ts`、任务表、callback、poll worker；封面 + 角色头像 → OSS | 封面与所有角色头像在 1–2 分钟内到位 |
| **B4 分镜文本** | `/storyboard/generate`；前端「一键出分镜」 | 5 个分镜文本与 prompt 落库 |
| **B5 分镜图 / 视频** | `/frames/:id/image`、`/frames/:id/video` | 用户能逐镜出图、出视频，全部 OSS |
| **B6 编辑 / 重试 / 删除** | 编辑 prompt、重试任务、二次确认删除（含 OSS 清理） | 删除后云端文件被清理；重试可恢复失败任务 |
| **B7 文档与上线** | `book-mall/doc/database/schema-changelog.md`、`book-mall/doc/logic/story-ai-pipeline.md`、`deploy/tencent/book-mall.env.example` 更新 | 部署时只需补 4 个新 env 即可上线 |

---

## 12. 上线检查表

- [ ] `book-mall/.env.local`：`KIE_API_KEY / KIE_API_BASE / KIE_CALLBACK_TOKEN / STORY_AI_POLL_TOKEN / STORY_AI_PUBLIC_BASE` 全部非空（LLM 与图像/视频共用同一把 `KIE_API_KEY`）
- [ ] OSS 配置（`OSS_BUCKET / OSS_REGION / OSS_PUBLIC_URL_BASE`）已就绪，能 put `story/cover/test.txt` 通过
- [ ] **`story-web/next.config.mjs`** `images.remotePatterns` 已加 OSS 主机名（虚拟域名 + `OSS_PUBLIC_URL_BASE`）
- [ ] `prisma migrate deploy` 在 Neon 生产库执行成功（含 `StoryOssCleanupQueue`）
- [ ] 腾讯云托管定时任务：每 30s 调 `/api/story/kie/poll`、每 60s 调 `/api/story/kie/cleanup` 已配置
- [ ] KIE 控制台：账号余额充足（封面 + 角色头像首批可能触发 ≥ 6 笔出图任务）
- [ ] story-web 部署：`STORY_WEB_ORIGINS` 加上 `https://story.ai-code8.com`
- [ ] book-mall：CORS 验证 OPTIONS 返回 204
- [ ] 二次确认 UI 走查：删除项目 / 重新生成 / 重新出分镜 均触发 2 次确认且第二次提到 OSS
- [ ] `story-web/.env.local` 中的 `KIE_API_KEY` 已注释（迁到 book-mall）

---

## 13. 决议结论（2026-05-22 已同步）

1. **画幅 / 风格的 KIE 映射** —— 不强制 1:1。封面 / 角色头像 / 分镜图 / 分镜视频 `aspect_ratio` 均按 `project.aspectRatio` 传入；角色头像保留**白底**要求（用于 frame `image_input` 一致性，不是画幅约束）。
2. **分镜数量** —— 在 UI 暴露 **3 / 5 / 8** 三档下拉，默认 5；后端仅接受这三个枚举值。
3. **分镜视频 `aspect_ratio`** —— 按项目画幅传入（同决议 1）。
4. **OSS 清理** —— 异步：删除接口立即返回，资源入 `StoryOssCleanupQueue`，cron worker（`POST /api/story/kie/cleanup`，60s 一次）扫描清理；attempts ≥ 3 后停手等人工介入。
5. **LLM 提供方（已修订 2026-05-22）** —— 不再走 OpenRouter；改为 KIE.AI 官方文档（`story-web/docs/kie/gemini 3 Flash.md`）的托管端点 `POST {KIE_API_BASE}/gemini-3-flash/v1/chat/completions`。理由：① 复用 `KIE_API_KEY`，无需新开 OpenRouter 账号；② 单 vendor 同时管 LLM/图像/视频；③ 模型路径已在文档明确。如需自部署 OpenAI 兼容网关，可通过 `STORY_AI_GEMINI_ENDPOINT` 整体覆盖端点。
6. **本地回调** —— 不使用 ngrok。`STORY_AI_PUBLIC_BASE` 在本地留空 → 不下发 `callBackUrl`；纯靠 poll worker（`pnpm story:poll-once` 手动 + 前端 `/tasks` 5s 轮询触发服务端 on-demand 拉 `recordInfo`），主要观察生成进度。生产再开启回调。

按 §11 分批落地，B0 起步。

---

## 14. 实施进度（2026-05-22 全量实施完成）

| 批次 | 状态 | 落地清单 |
|------|------|----------|
| **B0 数据建模** | ✅ | `prisma/schema.prisma` 新增 4 enum + 5 model；迁移 `20260705120000_story_web_phase3` 已 deploy；`book-mall/lib/story/{story-ai-constants.ts, comic-styles.ts, styles.json}` + `scripts/sync-story-styles.ts` |
| **B1 项目 CRUD** | ✅ | `book-mall/lib/story/{story-project-service.ts, api-helpers.ts}`；`/api/story/projects`、`/api/story/projects/:id`（GET/PATCH/DELETE 含软删 + OSS 入队）；`story-web/lib/projects/{api.ts, types.ts}`、`projects-page-client.tsx`、`create-project-form.tsx`、`project-card.tsx`、`project-workspace-client.tsx`、`story-setup-tab.tsx`、`storyboard-tab.tsx` 全部联后端；修复 2 个预存 TS 错误（`api/story/space`、`api/story/model-config`） |
| **B2 LLM 流水线** | ✅ | `gemini-llm-client.ts`（KIE `gemini-3-flash`，OpenAI 兼容；`response_format: json_object` + 代码块剥离 + 解析失败 1 次重试）；`story-initializer.ts`（大纲 + 角色）；`/api/story/projects/:id/initialize` |
| **B3 KIE 出图** | ✅ | `kie-client.ts`、`story-oss.ts`、`story-task-service.ts`；`/api/story/kie/{callback/:kind, poll, cleanup}`；`/api/story/projects/:id/{cover, characters/:characterId/avatar}`；`scripts/story-ai-{poll,cleanup}.ts` + pnpm 脚本 |
| **B4 分镜文本** | ✅ | `story-storyboard-service.ts`；`/api/story/projects/:id/storyboard/generate`（支持 `count ∈ 3/5/8` + `force=true`）；前端 storyboard tab 加 3/5/8 下拉 |
| **B5 分镜图 / 视频** | ✅ | `/api/story/projects/:id/frames/:frameId/{image,video}`；前端逐分镜「生成 / 重生」按钮 |
| **B6 编辑 / 重试 / 删除** | ✅ | character / frame `PATCH+DELETE`；`/api/story/projects/:id/tasks` GET；前端 `components/common/destructive-confirm-modal.tsx`（强制 2 步）；项目 / 角色 / 单分镜 / 整套分镜重生 全部接通二次确认 |
| **B7 文档与上线** | ✅ | 本节 + `doc/logic/story-ai-pipeline.md` 已对齐当前实现；`book-mall/.env.example` 已含全部新 env |

### 验证项

- `pnpm exec tsc --noEmit` 在 `book-mall` 与 `story-web` 均 0 error；
- `pnpm db:deploy` 已应用 phase3 迁移，`prisma migrate status` 干净；
- destructive-confirm-modal 替代了所有破坏性 API 入口的 `confirm()`；
- 本地无 callback 时，poll worker 可独立推进任务；
- OSS 清理走 `StoryOssCleanupQueue`，主流程不阻塞。

### 部署最小变更

1. `book-mall/.env.local` 补 5 个新键（`KIE_API_KEY` / `KIE_API_BASE` / `KIE_CALLBACK_TOKEN` / `STORY_AI_POLL_TOKEN` / `STORY_AI_PUBLIC_BASE`），LLM 与图像/视频共用 `KIE_API_KEY`；
2. 腾讯云托管定时任务两条：`POST /api/story/kie/poll`（30s）、`POST /api/story/kie/cleanup`（60s），`Authorization: Bearer ${STORY_AI_POLL_TOKEN}`；
3. `story-web` 把 `KIE_API_KEY` 从 `.env.local` 移除；
4. OSS bucket 设置 `public-read` ACL（已存在，无需新建）。

