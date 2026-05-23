# canvas-web 任务清单（do.md）

> 由 [plan.md](./plan.md) 拆出；按阶段顺序勾选。每条都写到能直接对应文件 / 命令。

## 阶段 0 · 脚手架 + 文档

- [x] 0.1 `canvas-web/package.json` 端口 3004，依赖：`@xyflow/react`、`zustand`、`zundo`、`dagre`、`nanoid`、`clsx`、`tailwind-merge`、`lucide-react`
- [x] 0.2 `canvas-web/tsconfig.json` `next.config.mjs` `tailwind.config.ts` `postcss.config.mjs` `.eslintrc.json` `.gitignore` `.env.example`
- [x] 0.3 `canvas-web/app/globals.css`（暗紫主题 token + `.twenty-*` 排版类）
- [x] 0.4 `canvas-web/lib/utils.ts` / `book-mall-base-url.server.ts` / `book-mall-client-request.ts` / `canvas-viewer-session.ts` / `site-config.ts`
- [x] 0.5 `canvas-web/components/book-mall-base-url-provider.tsx` / `canvas-auth-bar.tsx` / `layout/canvas-shell.tsx` / `auth/require-auth.tsx`
- [x] 0.6 `canvas-web/app/layout.tsx`、`canvas-web/app/page.tsx`（hero + 6 张 feature 卡）
- [x] 0.7 `canvas-web/app/api/book-mall/[...path]/route.ts`（生产差源代理）
- [x] 0.8 `canvas-web/docs/plan.md`、`canvas-web/docs/do.md`
- [x] 0.9 仓库根 `package.json` `dev:all` 加 `canvas` + `canvas-poll`（注：`canvas:poll-loop` 脚本将在阶段 2 补齐）

## 阶段 1 · tool-web 侧栏 +「AI 海报画布」组

- [x] 1.1 `tool-web/config/nav-tools.ts` 加新 group `ai-poster-canvas`（4 子项）
- [x] 1.2 `tool-web/lib/tool-suite-nav-keys.ts`、`book-mall/lib/tool-suite-nav-keys.ts` 加 key
- [x] 1.3 `book-mall/lib/tool-nav-labels.ts` 加 label
- [x] 1.4 Prisma 迁移 `INSERT INTO "ToolNavVisibility"`（mirror `20260703120000_tool_nav_story_theater`）
- [x] 1.5 `tool-web/lib/canvas-web-origin.ts`、`.env.example` 加 `NEXT_PUBLIC_CANVAS_WEB_ORIGIN`
- [x] 1.6 `tool-web/app/ai-poster-canvas/page.tsx`（首页 · 介绍 + CTA）
- [x] 1.7 `tool-web/app/ai-poster-canvas/studio/page.tsx`（创意画室 · 大图 hero + 跳转）
- [x] 1.8 `tool-web/app/ai-poster-canvas/gallery/page.tsx`（画作 · 占位）
- [x] 1.9 `tool-web/app/ai-poster-canvas/implementation/page.tsx`（实现逻辑）

## 阶段 2 · book-mall 后端基建

### 2.a Prisma & 迁移

- [x] 2.1 `book-mall/prisma/schema.prisma` 加 `Canvas*` 模型族 + 三个枚举
- [x] 2.2 手工 SQL 迁移 `20260706130000_canvas_v1`（shadow DB 不能 replay 历史，沿用 deploy）

### 2.b API 路由

- [x] 2.3 `app/api/canvas/viewer-session/route.ts`（mirror story）
- [x] 2.4 `app/api/canvas/engine-models/route.ts`（GET/POST + admin 守卫）
- [x] 2.5 `app/api/canvas/projects/route.ts` + `[id]/route.ts`
- [x] 2.6 `app/api/canvas/projects/[id]/nodes/[nodeId]/run/route.ts`
- [x] 2.7 `app/api/canvas/projects/[id]/tasks/route.ts`（5s 轮询入口）
- [x] 2.8 `app/api/canvas/uploads/route.ts`（图片直传 OSS）
- [x] 2.9 `app/api/canvas/templates/route.ts`
- [x] 2.10 `app/api/canvas/works/route.ts`
- [x] 2.11 `app/api/canvas/kie/{poll,callback,cleanup}/route.ts`

### 2.c task-service / KIE / OSS / 限流

- [ ] 2.12 `lib/canvas/cors.ts` `api-helpers.ts`（用 env `CANVAS_WEB_ORIGINS`）
- [ ] 2.13 `lib/canvas/canvas-task-service.ts`（mirror story；复用 KIE client + OSS）
- [ ] 2.14 `lib/canvas/canvas-constants.ts`：`getCanvasUserInflightMax`（默认 50）、`CANVAS_PROJECT_RUN_CAP=5`
- [ ] 2.15 `lib/canvas/build-image-input.ts`（多模型 KIE input 构造，支持多图融合）

### 2.d Poll loop & dev hub

- [x] 2.16 `book-mall/scripts/canvas-ai-poll-loop.ts` + `package.json` 加 `canvas:poll-once / canvas:poll-loop`
- [x] 2.17 `book-mall/lib/dev-hub-services.ts` 加 canvas 服务卡片 + background task
- [x] 2.18 `book-mall/app/dev/dev-hub-client.tsx` 加 `/dev/canvas/tasks` 入口
- [x] 2.19 `book-mall/app/dev/canvas/tasks/page.tsx` + client（mirror story-tasks-client）
- [x] 2.20 `book-mall/app/api/dev/canvas/tasks/route.ts` + `poll/route.ts`
- [x] 2.12 `lib/canvas/cors.ts` `api-helpers.ts`（用 env `CANVAS_WEB_ORIGINS`）
- [x] 2.13 `lib/canvas/canvas-task-service.ts`（mirror story；复用 KIE client + 自己的 OSS）
- [x] 2.14 `lib/canvas/canvas-constants.ts`：`getCanvasUserInflightMax`（默认 50）、单画布 5 上限
- [x] 2.15 `lib/canvas/canvas-task-service.ts:buildImageGenKieInput`（多模型 KIE input 构造）

## 阶段 3 · canvas-web 主题 / 登录（已在阶段 0 完成大部分；此阶段补充）

- [x] 3.1 首页 hero（自定义 6 个 feature 卡，先用占位文案）
- [x] 3.2 `/projects` 页（列出我的画布 + 「+ 新建」 + 二次确认删除）
- [x] 3.3 `/gallery` 页（拉 `/api/canvas/works`）
- [x] 3.4 `/models` 页（拉 `/api/canvas/engine-models`，admin 显示新增 / 启停）

## 阶段 4 · 画布编辑器（核心）

### 4.a 编辑器骨架

- [ ] 4.1 路由 `app/canvas/[id]/page.tsx` + `canvas-page-client.tsx`
- [ ] 4.2 `lib/canvas/store.ts`：zustand + zundo（节点 / 边 / viewport / 选区）
- [ ] 4.3 `components/canvas/flow-canvas.tsx`：React Flow 包装 + minimap + controls + background
- [ ] 4.4 工具栏：自动布局 / 撤销重做 / 分组 / 运行所有
- [ ] 4.5 `onDrop` / `onDragOver`：外部图片拖入 → blob URL → 后台上传 → 替换为 ossUrl
- [ ] 4.6 键盘快捷键：复制 / 粘贴 / 删除 / undo / redo / 框选

### 4.b 节点 UI

- [ ] 4.7 `components/canvas/nodes/image-node.tsx`
- [ ] 4.8 `components/canvas/nodes/text-node.tsx`
- [ ] 4.9 `components/canvas/nodes/product-params-node.tsx`
- [ ] 4.10 `components/canvas/nodes/ai-text-node.tsx`
- [ ] 4.11 `components/canvas/nodes/image-gen-node.tsx`
- [ ] 4.12 `components/canvas/nodes/output-node.tsx`
- [ ] 4.13 节点状态角标 component（idle / pending / running / done / error）+ failMessage tooltip

### 4.c 运行队列 & 轮询

- [ ] 4.14 `lib/canvas/topo.ts`：拓扑闭包 + inputHash
- [ ] 4.15 `lib/canvas/run-queue.ts`：单画布并发上限 5 队列
- [ ] 4.16 `lib/canvas/api.ts`：`runNode` / `getTasks` 客户端
- [ ] 4.17 5s 轮询任务状态 + 节点状态映射

## 阶段 5 · 模型 / 模板 / Gallery / 实现逻辑

- [ ] 5.1 Prisma seed：`CanvasEngineModel` 三条（`nano-banana-pro`、`gpt-image-1`、`kling-image`）
- [ ] 5.2 模型管理 UI（启用 / 禁用 / 设主选 / admin 新增）
- [ ] 5.3 内置模板 JSON 3 套：`templates/poster.ts` / `social-cover.ts` / `three-views.ts`
- [ ] 5.4 「+ 新建画布」选模板入口
- [ ] 5.5 用户模板「另存为」 + 列表
- [ ] 5.6 Gallery 列表（卡片 + lightbox）
- [ ] 5.7 实现逻辑页：tool-web 与 canvas-web 各一份

## 阶段 6 · 验收 + README

- [ ] 6.1 `pnpm dev:all` 同时拉起 6 进程；浏览器无报错
- [ ] 6.2 外部拖图入画布 → blob → ossUrl
- [ ] 6.3 单画布点 6 节点 → 第 6 排队
- [ ] 6.4 `/dev/canvas/tasks` 看任务流转
- [ ] 6.5 `canvas-web/README.md`（启动 / env / 命令）
- [ ] 6.6 仓库根 `docs/dev.md` / `deploy.md` 同步 canvas-web 段
